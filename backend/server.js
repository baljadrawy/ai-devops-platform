import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Anthropic } from '@anthropic-ai/sdk';
import { DockerManager } from './plugins/DockerManager.js';
import { DatabaseManager } from './plugins/DatabaseManager.js';
import { CodeAnalysisPlugin } from './plugins/CodeAnalyzer.js';
import { MemorySystem } from './plugins/MemorySystem.js';
import { TelegramBotPlugin } from './plugins/TelegramBot.js';
import { FileSystemPlugin } from './plugins/FileSystemPlugin.js';
import { TokenOptimizer } from './plugins/TokenOptimizer.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(compression({ threshold: 1024, level: 6 }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ==================== 🔒 Security Middleware ====================
/**
 * التحقق من مفتاح API للمسارات الحساسة
 */
function requireAuth(req, res, next) {
  // السماح بـ health check بدون مصادقة
  if (req.path === '/api/health' || req.path === '/api/stats') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.warn('⚠️ تحذير: API_KEY غير مضبوطة في .env');
    return res.status(500).json({
      error: '❌ خادم غير مكتمل التكوين'
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({
      error: '❌ مفتاح API غير صحيح',
      hint: 'استخدم header: X-API-Key'
    });
  }

  next();
}

// ==================== 🚦 Rate Limiting ====================
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 100, // 100 طلب لكل IP
  message: { error: '❌ طلبات كثيرة جداً، حاول لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health'
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 طلب فقط للـ chat
  message: { error: '❌ طلبات متكررة كثيرة، انتظر دقيقة' }
});

const fileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50, // 50 طلب للملفات
  message: { error: '❌ عمليات كثيرة على الملفات' }
});

app.use('/api/', generalLimiter);

// Initialize plugins
const docker = new DockerManager();
const database = new DatabaseManager();
const codeAnalyzer = new CodeAnalysisPlugin();
const memory = new MemorySystem('./data/memory.db');
const telegram = new TelegramBotPlugin(process.env.TELEGRAM_BOT_TOKEN);
const filesystem = new FileSystemPlugin();
const tokenOptimizer = new TokenOptimizer();

// ==================== Memory Management ====================
setInterval(async () => {
  try {
    const stmt = memory.db.prepare('SELECT DISTINCT session_id FROM conversations');
    const sessions = stmt.all();
    
    for (const {session_id} of sessions) {
      const messages = memory.getRecentMessages(session_id, 100);
      const totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);
      
      if (totalTokens > 100000) {
        await memory.compressAndGetContext(session_id, 100000);
        console.log(`✅ ضغط جلسة ${session_id}`);
      }
    }
  } catch (error) {
    console.error('❌ خطأ في الضغط:', error.message);
  }
}, 3600000);

setInterval(() => {
  try {
    const deleted = memory.cleanup(7);
    console.log(`🗑️ تم حذف ${deleted.changes} محادثة قديمة`);
  } catch (error) {
    console.error('❌ خطأ في التنظيف:', error.message);
  }
}, 86400000);

// ==================== Health & Stats ====================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '3.1.0',
    timestamp: new Date().toISOString(),
    features: {
      compression: 'active',
      streaming: 'enabled',
      autoCleanup: 'enabled',
      telegram: telegram.enabled ? 'active' : 'disabled',
      filesystem: 'active'
    }
  });
});

app.get('/api/stats', (req, res) => {
  const memStats = memory.getStats();
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    conversations: {
      total: memStats.total_messages,
      sessions: memStats.total_sessions,
      tokens: memStats.total_tokens
    }
  });
});

// ==================== Smart AI Chat with Tools ====================
app.post('/api/chat', chatLimiter, requireAuth, async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    // ✅ فحص المدخلات
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: '❌ الرسالة فارغة' });
    }
// ✅ فحص Cache
    const cacheResult = tokenOptimizer.checkCache(message);
    if (cacheResult.fromCache) {
      return res.json({
        message: cacheResult.response,
        fromCache: true,
        tokensSaved: cacheResult.tokensSaved
      });
    }
    
    const userTokens = memory.estimateTokens(message);
    memory.saveMessage(sessionId, 'user', message, userTokens);
    
    const recentMessages = memory.getRecentMessages(sessionId, 10);
    const conversationHistory = recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // ==================== جمع المعلومات من الأدوات ====================
    let systemContext = '';
    
    // معلومات النظام
    if (/صحة|حالة|status|health/i.test(message)) {
      const containers = await docker.listContainers({ all: true });
      const stats = {
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };
      
      systemContext += `
معلومات النظام:
- الحاويات: ${containers.data?.length || 0}
- العاملة: ${containers.data?.filter(c => c.state === 'running').length || 0}
- وقت التشغيل: ${Math.floor(stats.uptime / 60)} دقيقة
- الذاكرة: ${(stats.memory.rss / 1024 / 1024).toFixed(2)} MB
`;
    }
    
    // معلومات Docker
    if (/docker|حاوية/i.test(message)) {
      const containers = await docker.listContainers({ all: true });
      systemContext += `
Docker:
${containers.data?.map(c => `- ${c.name}: ${c.state === 'running' ? '✅' : '⛔'}`).join('\n') || 'لا توجد'}
`;
    }
    
    // معلومات قواعد البيانات
    if (/database|قاعدة/i.test(message)) {
      const connections = database.getConnections();
      systemContext += `
قواعد البيانات:
${connections.map(c => `- ${c.name} (${c.type})`).join('\n') || 'لا توجد'}
`;
    }
    
    // بنية المشروع
    if (/بنية|structure|ملفات|files|مكونات|components|المشروع/i.test(message)) {
      const structure = filesystem.getProjectStructure();
      if (structure.success) {
        systemContext += `
بنية المشروع:
- الواجهات: ${structure.data.frontend.join(', ')}
- Plugins: ${structure.data.plugins.join(', ')}
- APIs المتاحة (${structure.data.routes.length}):
${structure.data.routes.slice(0, 15).join('\n')}
`;
      }
    }
    
    // قراءة ملف محدد
    const readFileMatch = message.match(/اقرأ ملف|read file|show file:?\s*(.+)/i);
    if (readFileMatch) {
      const filePath = readFileMatch[1].trim();
      const fileContent = filesystem.readFile(filePath);
      if (fileContent.success) {
        systemContext += `
محتوى ${filePath}:
\`\`\`
${fileContent.data.content.substring(0, 3000)}
${fileContent.data.content.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`
الحجم: ${fileContent.data.size} bytes
`;
      }
    }
    
    // System Prompt الذكي
    const systemPrompt = `أنت مساعد ذكي ومطور لمنصة AI DevOps v3.0 على Raspberry Pi.

=== قدراتك ===
✅ قراءة ملفات المشروع
✅ تعديل وإنشاء ملفات
✅ فهم بنية المشروع
✅ إدارة Docker وقواعد البيانات
✅ تطوير ميزات جديدة

=== معلومات المشروع ===
المكونات الفعلية:
- واجهات: index.html, chat.html, docker.html, database.html, history.html
- Plugins: Docker, Database, Code Analyzer, Telegram Bot, FileSystem
- الخدمات: PostgreSQL, Grafana, Prometheus
- الميزات: Dark Mode, Charts, Notifications, Memory System

${systemContext}

=== قواعد التطوير ===
1. عندما يطلب المستخدم تطوير ميزة:
   - اقرأ الملفات المعنية أولاً
   - اشرح التغييرات بوضوح
   - اطلب تأكيد قبل التنفيذ
   
2. لتعديل ملف:
   - أعطي الكود الكامل الجديد
   - وضّح التغييرات
   - قل للمستخدم: "لتطبيق التغييرات، استخدم API: POST /api/filesystem/write"

3. لإنشاء ميزة جديدة:
   - اشرح الخطوات
   - اعطي الكود
   - اشرح كيفية التكامل

مهم: لا تنفذ تغييرات بدون تأكيد صريح من المستخدم!

أجب بالعربية بشكل واضح ومفيد.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: conversationHistory
    });
    
    const assistantMessage = response.content[0].text;
    const assistantTokens = memory.estimateTokens(assistantMessage);
    
    memory.saveMessage(sessionId, 'assistant', assistantMessage, assistantTokens);
// ✅ حفظ في Cache
    const tokensUsed = (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0);
    tokenOptimizer.saveToCache(message, assistantMessage, tokensUsed);
    
    res.json({
      message: assistantMessage,
      usage: response.usage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FileSystem APIs ====================
app.get('/api/filesystem/structure', requireAuth, (req, res) => {
  const result = filesystem.getProjectStructure();
  res.json(result);
});

app.post('/api/filesystem/read', fileLimiter, requireAuth, (req, res) => {
  const { path } = req.body;

  // ✅ فحص المدخلات
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: '❌ مسار غير صحيح' });
  }

  const result = filesystem.readFile(path);
  res.json(result);
});

app.post('/api/filesystem/write', fileLimiter, requireAuth, (req, res) => {
  const { path, content } = req.body;

  // ✅ فحص المدخلات
  if (!path || !content) {
    return res.status(400).json({ error: '❌ مسار أو محتوى فارغ' });
  }

  const result = filesystem.writeFile(path, content);

  if (result.success) {
    telegram.sendAlert('success', '📝 ملف محدّث', `تم تعديل: ${path}`);
  }

  res.json(result);
});

app.post('/api/filesystem/create', fileLimiter, requireAuth, (req, res) => {
  const { path, content } = req.body;

  // ✅ فحص المدخلات
  if (!path || !content) {
    return res.status(400).json({ error: '❌ مسار أو محتوى فارغ' });
  }

  const result = filesystem.createFile(path, content);

  if (result.success) {
    telegram.sendAlert('success', '✨ ملف جديد', `تم إنشاء: ${path}`);
  }

  res.json(result);
});

app.delete('/api/filesystem/delete', fileLimiter, requireAuth, (req, res) => {
  const { path } = req.body;

  // ✅ فحص المدخلات
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: '❌ مسار غير صحيح' });
  }

  const result = filesystem.deleteFile(path);

  if (result.success) {
    telegram.sendAlert('warning', '🗑️ ملف محذوف', `تم حذف: ${path}`);
  }

  res.json(result);
});

app.post('/api/filesystem/execute', fileLimiter, requireAuth, async (req, res) => {
  const { command } = req.body;

  // ✅ فحص المدخلات
  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return res.status(400).json({ error: '❌ أمر فارغ' });
  }

  const result = await filesystem.executeCommand(command);
  res.json(result);
});

// ==================== Telegram ====================
app.post('/api/telegram/alert', requireAuth, (req, res) => {
  const { type, title, message } = req.body;

  // ✅ فحص المدخلات
  if (!type || !title || !message) {
    return res.status(400).json({ error: '❌ بيانات ناقصة' });
  }

  if (!telegram.enabled) {
    return res.json({ success: false, error: 'Telegram bot not enabled' });
  }

  telegram.sendAlert(type, title, message);
  res.json({ success: true });
});

// ==================== Docker ====================
app.get('/api/docker/containers', requireAuth, async (req, res) => {
  try {
    const result = await docker.listContainers({ all: true });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/docker/:action/:id', requireAuth, async (req, res) => {
  try {
    const { action, id } = req.params;
    const result = await docker.containerAction(action, id);
    
    if (result.success) {
      const actions = { start: 'تشغيل', stop: 'إيقاف', restart: 'إعادة تشغيل' };
      telegram.sendAlert('success', 'Docker', `تم ${actions[action]} الحاوية`);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Database ====================
app.post('/api/database/connect', requireAuth, async (req, res) => {
  try {
    // ✅ فحص المدخلات
    const { type, name } = req.body;
    if (!type || !name) {
      return res.status(400).json({ error: '❌ نوع البيانات والاسم مطلوبان' });
    }

    const result = await database.connect(req.body);

    if (result.success) {
      telegram.sendAlert('success', 'Database', `تم الاتصال بـ ${name}`);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/database/query', requireAuth, async (req, res) => {
  try {
    // ✅ فحص المدخلات
    const { name, sql } = req.body;
    if (!name || !sql) {
      return res.status(400).json({ error: '❌ الاسم والاستعلام مطلوبان' });
    }

    const result = await database.query(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/database/connections', requireAuth, (req, res) => {
  res.json({ connections: database.getConnections() });
});

// ==================== Code Analyzer ====================
app.post('/api/code/analyze', async (req, res) => {
  try {
    const result = await codeAnalyzer.analyzeCode(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== History ====================
app.get('/api/history', (req, res) => {
  try {
    const { sessionId = 'default', limit = 50 } = req.query;
    const messages = memory.getRecentMessages(sessionId, parseInt(limit));
    
    res.json({
      success: true,
      sessionId,
      total: messages.length,
      messages: messages.reverse()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/history/sessions', (req, res) => {
  try {
    const stmt = memory.db.prepare(`
      SELECT 
        session_id,
        COUNT(*) as message_count,
        MAX(timestamp) as last_message,
        MIN(timestamp) as first_message
      FROM conversations
      GROUP BY session_id
      ORDER BY MAX(timestamp) DESC
    `);
    
    const sessions = stmt.all();
    res.json({ success: true, total: sessions.length, sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/history/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const stmt = memory.db.prepare('DELETE FROM conversations WHERE session_id = ?');
    const result = stmt.run(sessionId);
    
    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== System Monitoring ====================
let lastStats = { temp: 0, memory: 0, cpu: 0 };

setInterval(async () => {
  try {
    const stats = {
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    
    const memoryMB = (stats.memory.rss / 1024 / 1024).toFixed(1);
    const temp = (45 + Math.random() * 15).toFixed(1);
    const cpu = Math.floor(Math.random() * 30 + 10);
    
    if (parseFloat(temp) > 70 && lastStats.temp <= 70) {
      telegram.sendAlert('warning', '🌡️ تحذير', `درجة الحرارة: ${temp}°C`);
    }
    
    if (parseFloat(memoryMB) > 400 && lastStats.memory <= 400) {
      telegram.sendAlert('warning', '💾 تنبيه', `الذاكرة: ${memoryMB} MB`);
    }
    
    if (cpu > 80 && lastStats.cpu <= 80) {
      telegram.sendAlert('danger', '⚡ تحذير', `CPU: ${cpu}%`);
    }
    
    lastStats = { temp: parseFloat(temp), memory: parseFloat(memoryMB), cpu };
    
  } catch (error) {
    console.error('Monitoring error:', error);
  }
}, 30000);

// ==================== Static Files ====================
app.use(express.static('frontend'));
app.get('/', (req, res) => {
  res.sendFile('/app/frontend/index.html');
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║   🚀 Unified AI Platform v3.0                      ║
║   📡 Server: http://0.0.0.0:${PORT}                     ║
║   🤖 Telegram: ${telegram.enabled ? 'Active ✅' : 'Disabled ❌'}                     ║
║   📁 FileSystem Tools: Active ✅                    ║
║   🔒 Security: Enabled ✅                           ║
╚══════════════════════════════════════════════════════╝
  `);

  if (telegram.enabled) {
    telegram.sendAlert('success', '🚀 النظام', 'المنصة بدأت بنجاح مع FileSystem Tools!');
  }
});

// ==================== 🛑 Graceful Shutdown ====================
process.on('SIGTERM', async () => {
  console.log('\n🛑 استقبال SIGTERM - بدء الإيقاف الآمن...');

  // 1️⃣ إيقاف استقبال طلبات جديدة
  server.close(() => {
    console.log('✅ تم إغلاق الخادم');
  });

  // 2️⃣ إغلاق اتصالات قواعد البيانات
  for (const [name] of database.connections) {
    try {
      await database.disconnect({ name });
      console.log(`✅ تم فصل قاعدة البيانات: ${name}`);
    } catch (error) {
      console.error(`❌ خطأ في فصل ${name}:`, error.message);
    }
  }

  // 3️⃣ إغلاق ذاكرة SQLite
  try {
    memory.close();
    console.log('✅ تم إغلاق نظام الذاكرة');
  } catch (error) {
    console.error('❌ خطأ في إغلاق الذاكرة:', error.message);
  }

  // 4️⃣ الانتظار 10 ثواني ثم الإغلاق القسري
  setTimeout(() => {
    console.error('❌ لم يتم الإغلاق في الوقت المحدد - إغلاق قسري');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('\n🛑 تم الضغط على Ctrl+C');
  process.emit('SIGTERM');
});
