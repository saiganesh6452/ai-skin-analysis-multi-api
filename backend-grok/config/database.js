// config/database.js
const { MongoClient } = require('mongodb');
const config = require('./index');

let db = null;
let client = null;

async function connectDB() {
  try {
    client = new MongoClient(config.mongo.uri, config.mongo.options);
    await client.connect();
    db = client.db(config.mongo.dbName);

    // Indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection('reports').createIndex({ email: 1, createdAt: -1 });
    await db.collection('reports').createIndex({ reportId: 1 }, { unique: true });

    console.log(`  MongoDB connected: ${config.mongo.dbName}`);
    return db;
  } catch (e) {
    console.error('[MongoDB] Connection failed:', e.message);
    console.log('  Server will continue without database.\n');
    return null;
  }
}

function getDB() {
  return db;
}

async function closeDB() {
  if (client) await client.close();
}

module.exports = { connectDB, getDB, closeDB };
