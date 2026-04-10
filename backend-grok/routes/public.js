// routes/public.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { registerLimit, generalLimit, analyzeLimit, reportLimit } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../utils/errors');
const ctrl = require('../controllers/publicController');
const pay = require('../controllers/paymentController');

router.post('/register-user', registerLimit, asyncHandler(ctrl.registerUser));
router.post('/check-quality',  generalLimit, upload.single('image'), asyncHandler(ctrl.checkQuality));
router.post('/analyze',        analyzeLimit, upload.single('image'), asyncHandler(ctrl.analyze));
router.post('/generate-report', reportLimit, asyncHandler(ctrl.generateReport));

// Payment
router.post('/check-access',    generalLimit, asyncHandler(pay.checkAccess));
router.post('/create-order',    generalLimit, asyncHandler(pay.createOrder));
router.post('/verify-payment',  generalLimit, asyncHandler(pay.verifyPayment));

module.exports = router;
