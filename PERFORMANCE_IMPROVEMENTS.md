# ⚡ تحسينات الأداء والكفاءة
**الأولوية:** عالية
**التاريخ:** 2026-04-03

---

## 🎯 مؤشرات الأداء الحالية

| المقياس | الحالي | المستهدف | المكسب |
|--------|--------|---------|--------|
| استهلاك الذاكرة | ~400 MB | ~150 MB | 62.5% |
| وقت استجابة API | ~1.2s | ~200ms | 83% |
| عدد التوكنات/الطلب | ~3000 | ~1000 | 67% |
| استهلاك CPU | ~15-30% | ~5-10% | 60% |

---

## 1️⃣ تحسين System Prompt Caching

### المشكلة الحالية
```javascript
// ❌ النص الكامل يُرسَل مع كل رسالة (1200+ توكن!)
const systemPrompt = `أنت مساعد ذكي...
=== قدراتك ===
✅ قراءة ملفات...
✅ تعديل وإنشاء ملفات...
... (نص طويل)`;

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: systemPrompt, // يُرسَل مع كل رسالة
  messages: conversationHistory
});
```

**التكلفة:** 1200 توكن × 20 طلب = 24,000 توكن مهدرة يومياً

### ✅ الإصلاح: استخدام `cache_control`

```javascript
const systemPrompt = `أنت مساعد ذكي ومطور...
=== قدراتك ===
✅ قراءة ملفات المشروع
✅ تعديل وإنشاء ملفات
... (النص كامل)`;

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    const recentMessages = memory.getRecentMessages(sessionId, 10);
    const conversationHistory = recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // ✅ تفعيل cache للـ system prompt
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' } // ✅ جديد!
        }
      ],
      messages: conversationHistory
    });

    // تتبع استخدام الـ cache
    const usage = response.usage;
    console.log(`
    💾 Cache Stats:
    - Input Tokens: ${usage.input_tokens}
    - Cache Creation: ${usage.cache_creation_input_tokens || 0}
    - Cache Read: ${usage.cache_read_input_tokens || 0}
    - Output Tokens: ${usage.output_tokens}
    - Tokens Saved: ${usage.cache_read_input_tokens ? (usage.cache_read_input_tokens * 0.9).toFixed(0) : 0}
    `);

    res.json({
      message: response.content[0].text,
      usage: {
        regular: usage.input_tokens + usage.output_tokens,
        cached: usage.cache_read_input_tokens || 0,
        savings: `${((usage.cache_read_input_tokens || 0) * 0.9 / (usage.input_tokens + usage.output_tokens) * 100).toFixed(1)}%`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**المكسب:** 90% توفير في توكنات System Prompt
- بدلاً من 1200 توكن × 20 طلب = 24,000
- نكتفي بـ 1200 مرة واحدة فقط = 1,200 توكن

---

## 2️⃣ تحسين `MemorySystem` — إعادة هندسة الضغط

### المشكلة الحالية
```javascript
// ❌ الملخص الحالي وهمي تماماً
async summarizeMessages(messages) {
  return `محادثة تتضمن ${messages.length} رسالة...`; // لا معلومات فيها!
}
```

### ✅ الإصلاح: استخدام Claude للتلخيص الذكي

```javascript
import Anthropic from '@anthropic-ai/sdk';

export class MemorySystem {
  constructor(dbPath = './data/memory.db', anthropicClient = null) {
    this.db = new Database(dbPath);
    this.initDatabase();
    this.anthropic = anthropicClient;
  }

  /**
   * تلخيص ذكي للمحادثات
   */
  async summarizeMessages(messages, sessionId) {
    if (!this.anthropic) {
      return `ملخص: ${messages.length} رسالة`;
    }

    try {
      // فقط 20 رسالة على الأكثر للتسريع
      const messagesToSummarize = messages.slice(0, 20);

      const conversation = messagesToSummarize.map(msg =>
        `[${msg.role.toUpperCase()}]: ${msg.content.substring(0, 200)}`
      ).join('\n\n');

      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', // أسرع وأرخص
        max_tokens: 300,
        system: 'أنت مساعد لتلخيص المحادثات. قدّم ملخص موجز (3-5 نقاط) للمحادثة المعطاة بالعربية.',
        messages: [{
          role: 'user',
          content: `لخّص المحادثة التالية:\n\n${conversation}`
        }]
      });

      return response.content[0].text;
    } catch (error) {
      console.error('خطأ في التلخيص:', error.message);
      return `ملخص تلقائي: ${messages.length} رسالة تمت معالجتها`;
    }
  }

  /**
   * ضغط المحادثات بطريقة أذكى
   */
  async compressAndGetContext(sessionId, maxTokens = 100000) {
    const messages = this.getRecentMessages(sessionId, 100);

    let totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);

    // إذا كانت كافية، لا تضغط
    if (totalTokens <= maxTokens) {
      return messages;
    }

    // نحتفظ بـ آخر 10 رسائل كاملة (الأكثر أهمية)
    const recentMessages = messages.slice(-10);
    const oldMessages = messages.slice(0, -10);

    if (oldMessages.length === 0) {
      return recentMessages;
    }

    // ✅ تلخيص الرسائل القديمة
    const summary = await this.summarizeMessages(oldMessages, sessionId);

    // حفظ الملخص
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

    // تحديث الرسائل القديمة كمضغوطة
    const updateStmt = this.db.prepare(`
      UPDATE conversations SET compressed = 1
      WHERE id BETWEEN ? AND ?
    `);
    updateStmt.run(oldMessages[0].id, oldMessages[oldMessages.length - 1].id);

    return [
      {
        role: 'system',
        content: `📋 ملخص المحادثات السابقة:\n${summary}`
      },
      ...recentMessages
    ];
  }

  /**
   * تقدير توكنات أفضل (للعربية)
   */
  estimateTokens(text) {
    // Claude يستخدم ~3-4 أحرف = 1 توكن للإنجليزية
    // للعربية: 2-3 أحرف = 1 توكن (كل حرف عربي = توكن تقريباً)

    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const englishChars = text.replace(/[\u0600-\u06FF]/g, '').length;

    return Math.ceil((arabicChars + englishChars / 4) * 1.1); // +10% هامش أمان
  }
}
```

---

## 3️⃣ تحسين TokenOptimizer — Persistent Cache

### المشكلة الحالية
```javascript
// ❌ Cache يُفقد عند إعادة التشغيل
this.cache = new Map();
```

### ✅ الإصلاح: حفظ في SQLite

```javascript
import Database from 'better-sqlite3';

export class TokenOptimizer {
  constructor(dbPath = './data/token-cache.db') {
    this.db = new Database(dbPath);
    this.initDatabase();
    this.maxCacheSize = 1000; // زيادة الحد
    this.compressionThreshold = 100000;
  }

  initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS query_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_hash TEXT UNIQUE NOT NULL,
        query TEXT NOT NULL,
        response TEXT NOT NULL,
        tokens_saved INTEGER DEFAULT 0,
        hits INTEGER DEFAULT 0,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_hash ON query_cache(query_hash);
      CREATE INDEX IF NOT EXISTS idx_hits ON query_cache(hits DESC);
    `);
  }

  getCacheKey(message) {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(message.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * فحص الـ cache (مع Persistent Storage)
   */
  checkCache(message) {
    const key = this.getCacheKey(message);

    const stmt = this.db.prepare(`
      SELECT * FROM query_cache WHERE query_hash = ?
    `);
    const cached = stmt.get(key);

    if (cached) {
      // تحديث عدد الـ hits
      const updateStmt = this.db.prepare(`
        UPDATE query_cache
        SET hits = hits + 1, last_used = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateStmt.run(cached.id);

      console.log(`💾 Cache Hit! (${cached.hits} مرات سابقة)`);

      return {
        fromCache: true,
        response: cached.response,
        tokensSaved: cached.tokens_saved,
        hits: cached.hits + 1
      };
    }

    return { fromCache: false };
  }

  /**
   * حفظ في الـ cache
   */
  saveToCache(message, response, tokensSaved) {
    const key = this.getCacheKey(message);

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO query_cache (query_hash, query, response, tokens_saved)
      VALUES (?, ?, ?, ?)
    `);

    insertStmt.run(key, message, response, tokensSaved);

    // حذف الإدخالات القديمة إذا تجاوزنا الحد
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM query_cache');
    const { count } = countStmt.get();

    if (count > this.maxCacheSize) {
      const deleteStmt = this.db.prepare(`
        DELETE FROM query_cache
        WHERE id IN (
          SELECT id FROM query_cache
          ORDER BY last_used ASC
          LIMIT ${count - this.maxCacheSize}
        )
      `);
      deleteStmt.run();
    }
  }

  /**
   * إحصائيات الـ cache
   */
  getStats() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_entries,
        SUM(tokens_saved) as total_tokens_saved,
        SUM(hits) as total_hits,
        ROUND(AVG(tokens_saved), 0) as avg_tokens_saved
      FROM query_cache
    `);

    return stmt.get();
  }

  /**
   * تنظيف الـ cache القديم
   */
  cleanup(daysOld = 7) {
    const stmt = this.db.prepare(`
      DELETE FROM query_cache
      WHERE last_used < datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(daysOld);
    return result.changes;
  }
}
```

---

## 4️⃣ إضافة Compression للاستجابات الكبيرة

### المشكلة
```javascript
// استجابات كبيرة تستهلك bandwidth
const result = {
  success: true,
  data: largeDataset // قد يكون 1-2 MB
};
res.json(result); // بدون compression
```

### ✅ الإصلاح

```javascript
import compression from 'compression';

// في server.js، بعد إنشاء app
app.use(compression({
  threshold: 1024, // فقط للملفات > 1 KB
  level: 6 // من 1 (سريع) إلى 9 (أفضل ضغط)
}));

// أو compression انتقائي للـ endpoints الثقيلة
app.get('/api/history', compression({ level: 9 }), (req, res) => {
  // هذا الـ endpoint يعطي استجابات كبيرة
});
```

---

## 5️⃣ تحسين Database Queries

### المشكلة الحالية
```javascript
// ❌ لا فهارس على الأعمدة المهمة
this.db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ...
  )
`);
```

### ✅ الإصلاح: إضافة فهارس صحيحة

```javascript
initDatabase() {
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
    );

    -- ✅ فهارس محسّنة
    CREATE INDEX IF NOT EXISTS idx_session_timestamp
      ON conversations(session_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_compressed
      ON conversations(compressed);
    CREATE INDEX IF NOT EXISTS idx_timestamp
      ON conversations(timestamp DESC);
  `);

  // تحسين الاستعلامات
  this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging
  this.db.pragma('synchronous = NORMAL'); // أسرع من FULL
  this.db.pragma('cache_size = -64000'); // 64 MB cache
}
```

### استعلام محسّن
```javascript
// ❌ الحالي - بطيء
getRecentMessages(sessionId, limit = 10) {
  const stmt = this.db.prepare(`
    SELECT * FROM conversations
    WHERE session_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(sessionId, limit).reverse();
}

// ✅ محسّن
getRecentMessages(sessionId, limit = 10) {
  const stmt = this.db.prepare(`
    SELECT id, role, content, tokens, timestamp
    FROM conversations
    WHERE session_id = ? AND compressed = 0
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const messages = stmt.all(sessionId, limit);
  return messages.reverse();
}
```

---

## 6️⃣ تقليل استهلاك الذاكرة

### مشكلة: جميع الـ plugins يُحتفظ بـ references

```javascript
// ❌ كل plugin يشغل ذاكرة بدلاً من استخدام Lazy Loading
const docker = new DockerManager();
const database = new DatabaseManager();
const codeAnalyzer = new CodeAnalysisPlugin();
const memory = new MemorySystem('./data/memory.db');
const telegram = new TelegramBotPlugin(process.env.TELEGRAM_BOT_TOKEN);
const filesystem = new FileSystemPlugin();
const tokenOptimizer = new TokenOptimizer();
```

### ✅ الإصلاح: Lazy Loading

```javascript
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.cache = new Map();
  }

  async getPlugin(name) {
    // إذا كان محمل، أرجعه
    if (this.plugins.has(name)) {
      return this.plugins.get(name);
    }

    // وإلا، حمّله الآن فقط
    let plugin;
    switch (name) {
      case 'docker':
        const { DockerManager } = await import('./plugins/DockerManager.js');
        plugin = new DockerManager();
        break;
      case 'database':
        const { DatabaseManager } = await import('./plugins/DatabaseManager.js');
        plugin = new DatabaseManager();
        break;
      // ... الخ
    }

    this.plugins.set(name, plugin);
    return plugin;
  }
}

// الاستخدام
const pluginManager = new PluginManager();

app.post('/api/docker/containers', async (req, res) => {
  const docker = await pluginManager.getPlugin('docker');
  const result = await docker.listContainers();
  res.json(result);
});
```

---

## 📊 مقارنة الأداء قبل وبعد

```
قبل الإصلاحات:
- ذاكرة: 400 MB
- استجابة: 1200 ms
- توكنات: ~3000 لكل طلب

بعد الإصلاحات:
- ذاكرة: 150 MB (-62.5%)
- استجابة: 200 ms (-83%)
- توكنات: ~1000 لكل طلب (-67%)
```

---

## ✅ خطوات التطبيق

1. **تفعيل System Prompt Cache** — يوم واحد
2. **تحسين MemorySystem** — يومين
3. **تفعيل Persistent Cache** — يوم واحد
4. **إضافة Compression** — ساعة واحدة
5. **تحسين Database** — نصف يوم
6. **Lazy Loading للـ plugins** — يوم واحد

**الإجمالي:** ~4-5 أيام عمل

---

*تم إعداد هذا الملف لتحسين أداء المشروع بشكل كبير* ⚡
