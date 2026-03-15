import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Anthropic } from '@anthropic-ai/sdk';
import { DockerManager } from './plugins/DockerManager.js';
import { DatabaseManager } from './plugins/DatabaseManager.js';
import { CodeAnalysisPlugin } from './plugins/CodeAnalyzer.js';
import { MemorySystem } from './plugins/MemorySystem.js';
import { TelegramBotPlugin } from './plugins/TelegramBot.js';
import { FileSystemPlugin } from './plugins/FileSystemPlugin.js';
import { TokenOptimizer } from './plugins/TokenOptimizer.js';
import { RaspberryPiController } from './plugins/RaspberryPiController.js';
import { ToolsManager } from './plugins/ToolsManager.js';

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Initialize plugins
const docker = new DockerManager();
const database = new DatabaseManager();
const codeAnalyzer = new CodeAnalysisPlugin();
const memory = new MemorySystem('./data/memory.db');
const telegram = new TelegramBotPlugin(process.env.TELEGRAM_BOT_TOKEN);
const filesystem = new FileSystemPlugin();
const tokenOptimizer = new TokenOptimizer();
const piController = new RaspberryPiController();
const toolsManager = new ToolsManager();

// Auto Memory Management
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

// Health & Stats
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '3.1.0',
    timestamp: new Date().toISOString(),
    features: {
      tokenOptimization: 'active',
      piControl: 'active',
      smartTools: 'active',
      telegram: telegram.enabled ? 'active' : 'disabled'
    },
    tools: toolsManager.getSummary()
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
    },
    tools: toolsManager.getSummary()
  });
});

// Smart AI Chat with Optimization
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    const userTokens = memory.estimateTokens(message);
    memory.saveMessage(sessionId, 'user', message, userTokens);

    const recentMessages = memory.getRecentMessages(sessionId, 10);
    
    // Token Optimization
    const optimizationResult = tokenOptimizer.optimizeMessages(recentMessages, message);
    
    if (optimizationResult.fromCache) {
      console.log('💰 Cache hit!');
      return res.json({
        message: optimizationResult.response,
        fromCache: true,
        tokensSaved: userTokens
      });
    }

    // Auto-enable tools
    const autoEnabled = toolsManager.autoEnableByContext(message);

    // Gather context
    let systemContext = '';

    // Pi Info
    if (toolsManager.availableTools.pi_control.enabled && /صحة|حالة|status|health/i.test(message)) {
      const health = await piController.getHealthReport();
      if (health.success) {
        systemContext += `\n📊 النظام ${health.data.statusEmoji}\nCPU: ${health.data.metrics.cpu} | Memory: ${health.data.metrics.memory} | Temp: ${health.data.metrics.temperature}`;
      }
    }

    // Docker Info
    if (toolsManager.availableTools.docker.enabled && /docker|حاوية/i.test(message)) {
      const containers = await docker.listContainers({ all: true });
      if (containers.success) {
        systemContext += `\n🐳 Docker:\n${containers.data?.map(c => `- ${c.name}: ${c.state === 'running' ? '✅' : '⛔'}`).join('\n') || 'لا توجد'}`;
      }
    }

    // FileSystem
    if (toolsManager.availableTools.filesystem.enabled) {
      const readMatch = message.match(/اقرأ ملف|read file:?\s*(.+)/i);
      if (readMatch) {
        const filePath = readMatch[1].trim();
        const fileContent = filesystem.readFile(filePath);
        if (fileContent.success) {
          systemContext += `\n\n📄 ${filePath}:\n\`\`\`\n${fileContent.data.content.substring(0, 1500)}\n\`\`\``;
        }
      }
    }

    // Optimized System Prompt
    const systemPrompt = tokenOptimizer.createOptimizedSystemPrompt({
      hasDocker: toolsManager.availableTools.docker.enabled,
      hasDatabase: toolsManager.availableTools.database.enabled,
      hasFiles: toolsManager.availableTools.filesystem.enabled,
      hasPi: toolsManager.availableTools.pi_control.enabled
    }) + (systemContext ? `\n\n${systemContext}` : '');

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: optimizationResult.messages
    });

    const assistantMessage = response.content[0].text;
    const assistantTokens = memory.estimateTokens(assistantMessage);

    memory.saveMessage(sessionId, 'assistant', assistantMessage, assistantTokens);
    tokenOptimizer.cacheResponse(message, assistantMessage);

    res.json({
      message: assistantMessage,
      usage: response.usage,
      autoEnabledTools: autoEnabled
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pi Control APIs
app.get('/api/pi/info', async (req, res) => {
  const result = await piController.getSystemInfo();
  res.json(result);
});

app.get('/api/pi/health', async (req, res) => {
  const result = await piController.getHealthReport();
  if (result.success && result.data.status === 'critical') {
    telegram.sendAlert('danger', '🚨 تحذير', result.data.issues.join('\n'));
  }
  res.json(result);
});

app.post('/api/pi/execute', async (req, res) => {
  const { command } = req.body;
  const result = await piController.executeCommand(command);
  res.json(result);
});

// Tools Management
app.get('/api/tools', (req, res) => {
  res.json(toolsManager.getSummary());
});

app.post('/api/tools/enable/:name', (req, res) => {
  const result = toolsManager.enableTool(req.params.name);
  res.json(result);
});

app.post('/api/tools/disable/:name', (req, res) => {
  const result = toolsManager.disableTool(req.params.name);
  res.json(result);
});

// FileSystem APIs
app.get('/api/filesystem/structure', (req, res) => {
  const result = filesystem.getProjectStructure();
  res.json(result);
});

app.post('/api/filesystem/read', (req, res) => {
  const { path } = req.body;
  const result = filesystem.readFile(path);
  res.json(result);
});

app.post('/api/filesystem/write', (req, res) => {
  const { path, content } = req.body;
  const result = filesystem.writeFile(path, content);
  if (result.success) telegram.sendAlert('success', '📝 ملف محدّث', `${path}`);
  res.json(result);
});

app.post('/api/filesystem/create', (req, res) => {
  const { path, content } = req.body;
  const result = filesystem.createFile(path, content);
  if (result.success) telegram.sendAlert('success', '✨ ملف جديد', `${path}`);
  res.json(result);
});

app.delete('/api/filesystem/delete', (req, res) => {
  const { path } = req.body;
  const result = filesystem.deleteFile(path);
  if (result.success) telegram.sendAlert('warning', '🗑️ ملف محذوف', `${path}`);
  res.json(result);
});

// Telegram
app.post('/api/telegram/alert', (req, res) => {
  const { type, title, message } = req.body;
  if (!telegram.enabled) return res.json({ success: false, error: 'Telegram not enabled' });
  telegram.sendAlert(type, title, message);
  res.json({ success: true });
});

// Docker
app.get('/api/docker/containers', async (req, res) => {
  try {
    const result = await docker.listContainers({ all: true });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/docker/:action/:id', async (req, res) => {
  try {
    const { action, id } = req.params;
    const result = await docker.containerAction(action, id);
    if (result.success) {
      telegram.sendAlert('success', 'Docker', `${action} → ${id.substring(0, 12)}`);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database
app.post('/api/database/connect', async (req, res) => {
  try {
    const result = await database.connect(req.body);
    if (result.success) telegram.sendAlert('success', 'Database', `Connected to ${req.body.name}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/database/query', async (req, res) => {
  try {
    const result = await database.query(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/database/connections', (req, res) => {
  res.json({ connections: database.getConnections() });
});

// Code Analyzer
app.post('/api/code/analyze', async (req, res) => {
  try {
    const result = await codeAnalyzer.analyzeCode(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// History
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

// System Monitoring
setInterval(async () => {
  try {
    const health = await piController.getHealthReport();
    if (health.success && health.data.status === 'critical') {
      telegram.sendAlert('danger', '🔴 حالة حرجة', health.data.issues.join('\n'));
    }
  } catch (error) {
    console.error('Monitoring error:', error);
  }
}, 60000);

// Static Files
app.use(express.static('frontend'));
app.get('/', (req, res) => {
  res.sendFile('/app/frontend/index.html');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║   🚀 AI Platform v3.1 - OPTIMIZED                   ║
║   📡 Server: http://0.0.0.0:${PORT}                     ║
║   💰 Token Optimizer: Active ✅                     ║
║   🥧 Pi Controller: Active ✅                       ║
║   🔧 Tools: ${toolsManager.getSummary().enabled}/${toolsManager.getSummary().total} enabled                            ║
╚══════════════════════════════════════════════════════╝
  `);

  if (telegram.enabled) {
    telegram.sendAlert('success', '🚀 النظام', 'v3.1 بدأت بنجاح!');
  }
});

// ==================== Prometheus Metrics ====================
app.get('/metrics', (req, res) => {
  const memStats = memory.getStats();
  const toolsStats = toolsManager.getSummary();
  
  let metrics = `# HELP ai_agent_tokens_used_total Total tokens used
# TYPE ai_agent_tokens_used_total counter
ai_agent_tokens_used_total ${memStats.total_tokens}

# HELP ai_agent_cache_hits_total Cache hits
# TYPE ai_agent_cache_hits_total counter
ai_agent_cache_hits_total ${tokenOptimizer.cache.size}

# HELP ai_agent_tools_enabled Number of enabled tools
# TYPE ai_agent_tools_enabled gauge
ai_agent_tools_enabled ${toolsStats.enabled}

# HELP ai_agent_uptime_seconds Uptime in seconds
# TYPE ai_agent_uptime_seconds gauge
ai_agent_uptime_seconds ${process.uptime()}
`;

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// ==================== Prometheus Metrics ====================
app.get('/metrics', (req, res) => {
  const memStats = memory.getStats();
  const toolsStats = toolsManager.getSummary();
  
  let metrics = `# HELP ai_agent_tokens_used_total Total tokens used
# TYPE ai_agent_tokens_used_total counter
ai_agent_tokens_used_total ${memStats.total_tokens}

# HELP ai_agent_cache_hits_total Cache hits
# TYPE ai_agent_cache_hits_total counter
ai_agent_cache_hits_total ${tokenOptimizer.cache.size}

# HELP ai_agent_tools_enabled Number of enabled tools
# TYPE ai_agent_tools_enabled gauge
ai_agent_tools_enabled ${toolsStats.enabled}

# HELP ai_agent_uptime_seconds Uptime in seconds
# TYPE ai_agent_uptime_seconds gauge
ai_agent_uptime_seconds ${process.uptime()}
`;

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});
