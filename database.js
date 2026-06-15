// database.js
const { Pool } = require('pg');
require('dotenv').config();

// إعداد اتصال PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'chatuser',
  password: process.env.DB_PASSWORD || 'chatpass123',
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'chatdb',
});

// اختبار الاتصال
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL:', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL');
    release(); // تحرير الاتصال بعد الاختبار 
  }
});

// إنشاء الجداول (في حالة عدم وجودها)
const initDatabase = async () => {
  try {
    // جدول الرسائل
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user VARCHAR(50) NOT NULL,
        to_user VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        status VARCHAR(20) DEFAULT 'sent',
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        trace_id UUID DEFAULT gen_random_uuid() 
      )
    `);

    // جدول الرسائل غير المسلمة
    await pool.query(`
      CREATE TABLE IF NOT EXISTS offline_messages (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        message_id UUID NOT NULL, 
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);

    // جدول حالة المستخدمين
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_states (
        user_id VARCHAR(50) PRIMARY KEY,
        status VARCHAR(20) DEFAULT 'offline',
        last_heartbeat BIGINT, 
        current_socket_id VARCHAR(100)
      )
    `);

    // إنشاء فهارس (Indexes) لتحسين الأداء
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_from_to 
      ON messages(from_user, to_user);
      
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
      ON messages(timestamp DESC);
      
      CREATE INDEX IF NOT EXISTS idx_offline_user 
      ON offline_messages(user_id);
    `);

    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
};

initDatabase();

module.exports = pool;