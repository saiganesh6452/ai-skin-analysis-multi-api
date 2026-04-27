// controllers/paymentController.js
const crypto = require('crypto');
const { getDB } = require('../config/database');
const config = require('../config');

// Check if user has a free analysis remaining
async function checkAccess(req, res) {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const db = getDB();
  if (!db) {
    // No DB = can't track usage, allow free
    return res.json({ success: true, hasAccess: true, reason: 'free' });
  }

  // Count actual completed analyses from reports collection
  const analysisCount = await db.collection('reports').countDocuments({ email });

  // Check if user has paid for additional analyses
  const activePurchase = await db.collection('payments').findOne({
    email,
    status: 'paid',
    usedAt: null,
  });

  // First analysis is free
  if (analysisCount === 0) {
    return res.json({ success: true, hasAccess: true, reason: 'free', analysisCount });
  }

  // Has an unused payment
  if (activePurchase) {
    return res.json({ success: true, hasAccess: true, reason: 'paid', analysisCount, paymentId: activePurchase.orderId });
  }

  // Must pay
  return res.json({
    success: true,
    hasAccess: false,
    reason: 'payment_required',
    analysisCount,
    price: config.payment.priceAmount,
    currency: config.payment.currency,
  });
}

// Create a payment order
async function createOrder(req, res) {
  const email = (req.body.email || '').trim().toLowerCase();
  const name = req.body.name || '';
  const phone = req.body.phone || '';
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const db = getDB();
  const orderId = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  const order = {
    orderId,
    email,
    name,
    phone,
    amount: config.payment.priceAmount,
    currency: config.payment.currency,
    status: 'pending',
    createdAt: new Date(),
    usedAt: null,
  };

  if (db) {
    await db.collection('payments').insertOne(order);
  }

  console.log(`[Payment] Order created: ${orderId} for ${email} — ₹${config.payment.priceAmount}`);

  res.json({
    success: true,
    orderId,
    amount: config.payment.priceAmount,
    currency: config.payment.currency,
    merchantId: config.payment.gokwik.merchantId,
    environment: config.payment.gokwik.environment,
    // Pass customer info for GoKwik checkout
    customer: { name, email, phone },
  });
}

// Verify payment (called after GoKwik checkout completes)
async function verifyPayment(req, res) {
  const { orderId, paymentId, status, signature } = req.body;
  if (!orderId) return res.status(400).json({ success: false, error: 'Order ID required' });

  const db = getDB();
  if (!db) return res.json({ success: true, verified: true });

  const order = await db.collection('payments').findOne({ orderId });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  // TODO: Verify signature with GoKwik app secret when you have their SDK docs
  // const expectedSignature = crypto
  //   .createHmac('sha256', config.payment.gokwik.appSecret)
  //   .update(orderId + '|' + paymentId)
  //   .digest('hex');
  // if (signature !== expectedSignature) {
  //   return res.status(400).json({ success: false, error: 'Invalid signature' });
  // }

  if (status === 'success' || status === 'paid') {
    await db.collection('payments').updateOne(
      { orderId },
      { $set: { status: 'paid', paymentId, verifiedAt: new Date() } }
    );
    console.log(`[Payment] Verified: ${orderId} → ${paymentId}`);
    return res.json({ success: true, verified: true });
  }

  await db.collection('payments').updateOne(
    { orderId },
    { $set: { status: 'failed', paymentId, failedAt: new Date() } }
  );
  return res.json({ success: true, verified: false, reason: 'Payment not successful' });
}

// Mark a paid order as used (called after analysis completes)
async function markUsed(orderId) {
  const db = getDB();
  if (!db || !orderId) return;
  await db.collection('payments').updateOne(
    { orderId, status: 'paid' },
    { $set: { usedAt: new Date() } }
  );
}

module.exports = { checkAccess, createOrder, verifyPayment, markUsed };
