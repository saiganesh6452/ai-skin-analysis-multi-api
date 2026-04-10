// config/index.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'production',
  isProduction: (process.env.NODE_ENV || 'production') === 'production',

  mongo: {
    uri: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017',
    dbName: process.env.DB_NAME || 'dermaai',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  ai: {
    apiKey: process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
    model: 'grok-4',
    maxTokens: 4096,
  },

  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'ap-south-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },

  payment: {
    priceAmount: parseInt(process.env.PAYMENT_AMOUNT || '199', 10),  // in INR
    currency: process.env.PAYMENT_CURRENCY || 'INR',
    gokwik: {
      merchantId: process.env.GOKWIK_MERCHANT_ID || '',
      appId: process.env.GOKWIK_APP_ID || '',
      appSecret: process.env.GOKWIK_APP_SECRET || '',
      environment: process.env.GOKWIK_ENV || 'sandbox', // 'sandbox' or 'production'
    },
  },

  admin: {
    key: process.env.ADMIN_KEY || null,
  },

  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5001'],
  },

  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  rateLimit: {
    general:  { windowMs: 60000, max: 30 },
    analyze:  { windowMs: 60000, max: 5 },
    register: { windowMs: 60000, max: 10 },
    report:   { windowMs: 60000, max: 10 },
    admin:    { windowMs: 60000, max: 60 },
  },
};
