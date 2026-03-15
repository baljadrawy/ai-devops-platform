/**
 * ToolsManager.js - نظام إدارة الأدوات الذكي
 * يتيح تفعيل/تعطيل Tools حسب الحاجة لتوفير Tokens
 */

export class ToolsManager {
  constructor() {
    // قائمة الأدوات المتاحة
    this.availableTools = {
      // ==================== System Tools ====================
      pi_control: {
        enabled: true,
        name: 'Raspberry Pi Control',
        description: 'التحكم في نظام Raspberry Pi',
        tools: ['get_system_info', 'get_health_report', 'execute_command'],
        cost: 'medium', // تكلفة الـ tokens
        priority: 'high',
      },

      // ==================== Docker Tools ====================
      docker: {
        enabled: true,
        name: 'Docker Management',
        description: 'إدارة حاويات Docker',
        tools: ['list_containers', 'container_action', 'get_stats'],
        cost: 'low',
        priority: 'high',
      },

      // ==================== Database Tools ====================
      database: {
        enabled: false, // معطل افتراضياً
        name: 'Database Tools',
        description: 'إدارة قواعد البيانات',
        tools: ['list_databases', 'execute_query', 'schema_info'],
        cost: 'medium',
        priority: 'medium',
      },

      // ==================== FileSystem Tools ====================
      filesystem: {
        enabled: true,
        name: 'FileSystem Tools',
        description: 'قراءة وكتابة الملفات',
        tools: ['read_file', 'write_file', 'create_file', 'delete_file'],
        cost: 'high', // قد تحتوي على محتوى كبير
        priority: 'high',
      },

      // ==================== Code Analysis ====================
      code_analysis: {
        enabled: false,
        name: 'Code Analyzer',
        description: 'تحليل الأكواد',
        tools: ['analyze_code', 'generate_tests', 'lint_code'],
        cost: 'very_high',
        priority: 'low',
      },

      // ==================== Git Tools ====================
      git: {
        enabled: false,
        name: 'Git Integration',
        description: 'عمليات Git',
        tools: ['list_repos', 'commit', 'push', 'pull'],
        cost: 'medium',
        priority: 'low',
      },
    };

    // الأدوات المُفعّلة حالياً
    this.activeTools = this._getActiveTools();

    // إحصائيات الاستخدام
    this.stats = {
      totalCalls: 0,
      callsByTool: {},
      tokensSaved: 0,
    };
  }

  /**
   * تفعيل أداة
   */
  enableTool(toolName) {
    if (!this.availableTools[toolName]) {
      return { success: false, error: 'Tool not found' };
    }

    this.availableTools[toolName].enabled = true;
    this.activeTools = this._getActiveTools();

    return {
      success: true,
      message: `✅ تم تفعيل: ${this.availableTools[toolName].name}`,
    };
  }

  /**
   * تعطيل أداة
   */
  disableTool(toolName) {
    if (!this.availableTools[toolName]) {
      return { success: false, error: 'Tool not found' };
    }

    this.availableTools[toolName].enabled = false;
    this.activeTools = this._getActiveTools();

    return {
      success: true,
      message: `⛔ تم تعطيل: ${this.availableTools[toolName].name}`,
    };
  }

  /**
   * تفعيل تلقائي حسب السياق
   */
  autoEnableByContext(message) {
    const enabled = [];
    const message_lower = message.toLowerCase();

    // Docker
    if (/docker|حاوية|container/i.test(message)) {
      if (!this.availableTools.docker.enabled) {
        this.enableTool('docker');
        enabled.push('docker');
      }
    }

    // Database
    if (/database|قاعدة|sql|postgres|mysql/i.test(message)) {
      if (!this.availableTools.database.enabled) {
        this.enableTool('database');
        enabled.push('database');
      }
    }

    // FileSystem
    if (/ملف|file|read|write|اقرأ|اكتب/i.test(message)) {
      if (!this.availableTools.filesystem.enabled) {
        this.enableTool('filesystem');
        enabled.push('filesystem');
      }
    }

    // Code Analysis
    if (/تحليل|analyze|lint|test|كود|code/i.test(message)) {
      if (!this.availableTools.code_analysis.enabled) {
        this.enableTool('code_analysis');
        enabled.push('code_analysis');
      }
    }

    // Git
    if (/git|commit|push|pull|repo/i.test(message)) {
      if (!this.availableTools.git.enabled) {
        this.enableTool('git');
        enabled.push('git');
      }
    }

    if (enabled.length > 0) {
      console.log(`🔧 Auto-enabled tools: ${enabled.join(', ')}`);
    }

    return enabled;
  }

  /**
   * تعطيل تلقائي للأدوات غير المستخدمة
   */
  autoDisableUnused(conversationAge = 5) {
    // بعد 5 رسائل بدون استخدام → تعطيل تلقائي
    const disabled = [];

    for (const [name, tool] of Object.entries(this.availableTools)) {
      if (tool.enabled && tool.priority === 'low') {
        const lastUsed = this.stats.callsByTool[name]?.lastUsed || 0;
        const messagesSinceUse = conversationAge - lastUsed;

        if (messagesSinceUse > 5) {
          this.disableTool(name);
          disabled.push(name);
        }
      }
    }

    if (disabled.length > 0) {
      console.log(`💤 Auto-disabled unused tools: ${disabled.join(', ')}`);
    }

    return disabled;
  }

  /**
   * الحصول على Tools Definition لـ Claude
   */
  getToolsDefinition() {
    const tools = [];

    for (const [name, config] of Object.entries(this.availableTools)) {
      if (!config.enabled) continue;

      // إضافة كل أداة من الأدوات الفرعية
      for (const toolName of config.tools) {
        tools.push(this._getToolSchema(toolName, name));
      }
    }

    return tools;
  }

  /**
   * الحصول على Schema لأداة محددة
   */
  _getToolSchema(toolName, category) {
    // هنا يمكنك تعريف Schema لكل أداة
    const schemas = {
      // System Tools
      get_system_info: {
        name: 'get_system_info',
        description: 'الحصول على معلومات النظام (CPU, Memory, Disk, Temperature)',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
      get_health_report: {
        name: 'get_health_report',
        description: 'تقرير صحة النظام مع الإشعارات',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
      execute_command: {
        name: 'execute_command',
        description: 'تنفيذ أمر shell آمن',
        input_schema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'الأمر المراد تنفيذه',
            },
          },
          required: ['command'],
        },
      },

      // Docker Tools
      list_containers: {
        name: 'list_containers',
        description: 'عرض جميع حاويات Docker',
        input_schema: {
          type: 'object',
          properties: {
            all: {
              type: 'boolean',
              description: 'عرض الحاويات المتوقفة أيضاً',
              default: true,
            },
          },
        },
      },

      // FileSystem Tools
      read_file: {
        name: 'read_file',
        description: 'قراءة محتوى ملف',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'مسار الملف',
            },
          },
          required: ['path'],
        },
      },

      // ... أضف باقي الأدوات
    };

    return schemas[toolName] || null;
  }

  /**
   * تسجيل استخدام أداة
   */
  recordToolUse(toolName, tokensUsed = 0) {
    this.stats.totalCalls++;

    if (!this.stats.callsByTool[toolName]) {
      this.stats.callsByTool[toolName] = {
        count: 0,
        totalTokens: 0,
        lastUsed: 0,
      };
    }

    this.stats.callsByTool[toolName].count++;
    this.stats.callsByTool[toolName].totalTokens += tokensUsed;
    this.stats.callsByTool[toolName].lastUsed = Date.now();
  }

  /**
   * الحصول على الأدوات المفعّلة
   */
  _getActiveTools() {
    return Object.entries(this.availableTools)
      .filter(([_, config]) => config.enabled)
      .map(([name, config]) => ({
        name,
        ...config,
      }));
  }

  /**
   * الحصول على ملخص الأدوات
   */
  getSummary() {
    const enabled = this.activeTools.length;
    const total = Object.keys(this.availableTools).length;

    return {
      enabled,
      total,
      disabled: total - enabled,
      list: this.activeTools.map(t => t.name),
      stats: this.stats,
    };
  }

  /**
   * إعادة تعيين الإحصائيات
   */
  resetStats() {
    this.stats = {
      totalCalls: 0,
      callsByTool: {},
      tokensSaved: 0,
    };
  }

  /**
   * حفظ الإعدادات
   */
  saveConfig() {
    const config = {};
    for (const [name, tool] of Object.entries(this.availableTools)) {
      config[name] = tool.enabled;
    }
    return config;
  }

  /**
   * تحميل الإعدادات
   */
  loadConfig(config) {
    for (const [name, enabled] of Object.entries(config)) {
      if (this.availableTools[name]) {
        this.availableTools[name].enabled = enabled;
      }
    }
    this.activeTools = this._getActiveTools();
  }
}

/**
 * مثال الاستخدام:
 * 
 * const toolsManager = new ToolsManager();
 * 
 * // تفعيل تلقائي حسب السياق
 * toolsManager.autoEnableByContext("أريد تحليل كود Python");
 * // سيُفعّل: code_analysis
 * 
 * // الحصول على Tools لـ Claude
 * const tools = toolsManager.getToolsDefinition();
 * 
 * // في API call:
 * const response = await anthropic.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   max_tokens: 1024,
 *   tools: tools, // فقط الأدوات المفعّلة!
 *   messages: [...]
 * });
 * 
 * // تعطيل تلقائي للأدوات غير المستخدمة
 * toolsManager.autoDisableUnused(conversationAge);
 * 
 * // عرض الملخص
 * console.log(toolsManager.getSummary());
 */
