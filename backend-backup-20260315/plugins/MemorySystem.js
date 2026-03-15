import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * نظام ذاكرة متقدم مع ضغط التوكنات
 */
export class MemorySystem {
  constructor(dbPath = './data/memory.db') {
    // إنشاء المجلد إذا لم يكن موجود
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initDatabase();
  }

  initDatabase() {
    // جدول المحادثات
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        importance INTEGER DEFAULT 5,
        compressed INTEGER DEFAULT 0
      )
    `);

    // جدول المعرفة المستخرجة
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        source_id INTEGER,
        confidence REAL DEFAULT 1.0,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, key)
      )
    `);

    // جدول الملخصات
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        start_id INTEGER NOT NULL,
        end_id INTEGER NOT NULL,
        summary TEXT NOT NULL,
        tokens_saved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // إنشاء الفهارس
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON conversations(timestamp);
      CREATE INDEX IF NOT EXISTS idx_category ON knowledge(category);
    `);
  }

  /**
   * حفظ رسالة جديدة
   */
  saveMessage(sessionId, role, content, tokens = 0, importance = 5) {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (session_id, role, content, tokens, importance)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    return stmt.run(sessionId, role, content, tokens, importance);
  }

  /**
   * استرجاع المحادثات الأخيرة
   */
  getRecentMessages(sessionId, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    return stmt.all(sessionId, limit).reverse();
  }

  /**
   * استرجاع السياق مع الضغط التلقائي
   */
  getContext(sessionId, maxTokens = 100000) {
    const messages = this.getRecentMessages(sessionId, 50);
    let totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);

    // إذا تجاوز الحد، نضغط الرسائل القديمة
    if (totalTokens > maxTokens) {
      return this.compressAndGetContext(sessionId, maxTokens);
    }

    return messages;
  }

  /**
   * ضغط المحادثات القديمة
   */
  async compressAndGetContext(sessionId, maxTokens) {
    const messages = this.getRecentMessages(sessionId, 100);
    
    // نحتفظ بآخر 10 رسائل كاملة
    const recentMessages = messages.slice(-10);
    const oldMessages = messages.slice(0, -10);

    if (oldMessages.length === 0) {
      return recentMessages;
    }

    // نلخص الرسائل القديمة
    const summary = await this.summarizeMessages(oldMessages);
    
    // نحفظ الملخص
    const stmt = this.db.prepare(`
      INSERT INTO summaries (session_id, start_id, end_id, summary, tokens_saved)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const tokensSaved = oldMessages.reduce((sum, msg) => sum + msg.tokens, 0);
    stmt.run(
      sessionId,
      oldMessages[0].id,
      oldMessages[oldMessages.length - 1].id,
      summary,
      tokensSaved
    );

    // نحذف الرسائل المضغوطة
    const deleteStmt = this.db.prepare(`
      UPDATE conversations SET compressed = 1
      WHERE id BETWEEN ? AND ?
    `);
    deleteStmt.run(oldMessages[0].id, oldMessages[oldMessages.length - 1].id);

    return [
      { role: 'system', content: `ملخص المحادثات السابقة: ${summary}` },
      ...recentMessages
    ];
  }

  /**
   * تلخيص مجموعة رسائل
   */
  async summarizeMessages(messages) {
    const conversation = messages.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    // هنا يمكن استخدام Claude أو نموذج آخر للتلخيص
    // للتبسيط، سنستخدم ملخص بسيط
    return `محادثة تتضمن ${messages.length} رسالة حول المواضيع التالية...`;
  }

  /**
   * حفظ معرفة مستخرجة
   */
  saveKnowledge(category, key, value, sourceId = null, confidence = 1.0) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO knowledge (category, key, value, source_id, confidence)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    return stmt.run(category, key, value, sourceId, confidence);
  }

  /**
   * استرجاع معرفة
   */
  getKnowledge(category, key = null) {
    if (key) {
      const stmt = this.db.prepare(`
        SELECT * FROM knowledge
        WHERE category = ? AND key = ?
      `);
      return stmt.get(category, key);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM knowledge
      WHERE category = ?
      ORDER BY confidence DESC
    `);
    return stmt.all(category);
  }

  /**
   * تحديث آخر استخدام للمعرفة
   */
  updateKnowledgeUsage(id) {
    const stmt = this.db.prepare(`
      UPDATE knowledge
      SET last_used = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  }

  /**
   * حساب التوكنات التقريبي
   */
  estimateTokens(text) {
    // تقدير بسيط: 4 أحرف = 1 توكن تقريباً
    return Math.ceil(text.length / 4);
  }

  /**
   * إحصائيات الذاكرة
   */
  getStats(sessionId = null) {
    if (sessionId) {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_messages,
          SUM(tokens) as total_tokens,
          SUM(CASE WHEN compressed = 1 THEN 1 ELSE 0 END) as compressed_messages
        FROM conversations
        WHERE session_id = ?
      `);
      return stmt.get(sessionId);
    }

    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_messages,
        SUM(tokens) as total_tokens,
        COUNT(DISTINCT session_id) as total_sessions
      FROM conversations
    `);
    return stmt.get();
  }

  /**
   * تنظيف البيانات القديمة
   */
  cleanup(daysOld = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM conversations
      WHERE timestamp < datetime('now', '-' || ? || ' days')
      AND compressed = 1
    `);
    return stmt.run(daysOld);
  }

  /**
   * إغلاق قاعدة البيانات
   */
  close() {
    this.db.close();
  }
}
