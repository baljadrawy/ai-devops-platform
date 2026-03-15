import { EventEmitter } from 'events';
import ContextModeWrapper from '../utils/ContextModeWrapper.js';

/**
 * System Monitor مع Self-Healing
 * + Context Mode للسجلات الكبيرة
 */
export class SystemMonitor extends EventEmitter {
  constructor({ docker, database, autoHeal = true }) {
    super();
    
    this.docker = docker;
    this.database = database;
    this.autoHeal = autoHeal;
    this.contextMode = new ContextModeWrapper();
    
    this.containerStats = new Map();
    this.metricsSubscribers = new Set();
    this.interval = null;
  }

  /**
   * بدء المراقبة
   */
  start(intervalMs = 60000) {
    console.log('🔍 بدء مراقبة النظام...');
    
    this.interval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);

    // فحص فوري
    this.checkHealth();
  }

  /**
   * فحص صحة النظام
   */
  async checkHealth() {
    try {
      // فحص الحاويات
      const containersHealth = await this.checkContainers();
      
      // فحص قواعد البيانات
      const dbHealth = await this.checkDatabases();

      // إرسال المقاييس للمشتركين
      this.broadcastMetrics({
        timestamp: new Date().toISOString(),
        containers: containersHealth,
        databases: dbHealth
      });

      return {
        healthy: containersHealth.healthy && dbHealth.healthy,
        containers: containersHealth,
        databases: dbHealth
      };

    } catch (error) {
      console.error('خطأ في فحص الصحة:', error);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * فحص الحاويات + إصلاح تلقائي
   */
  async checkContainers() {
    try {
      const result = await this.docker.listContainers({ all: true });
      
      if (!result.success) {
        return { healthy: false, error: result.error };
      }

      const stoppedContainers = result.data.filter(c => c.state !== 'running');

      // إصلاح ذاتي
      if (this.autoHeal && stoppedContainers.length > 0) {
        for (const container of stoppedContainers) {
          await this.healContainer(container);
        }
      }

      this.containerStats.set('total', result.count);
      this.containerStats.set('running', result.count - stoppedContainers.length);
      this.containerStats.set('stopped', stoppedContainers.length);

      return {
        healthy: stoppedContainers.length === 0,
        total: result.count,
        running: result.count - stoppedContainers.length,
        stopped: stoppedContainers.length
      };

    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * إصلاح حاوية متوقفة
   */
  async healContainer(container) {
    console.log(`🔧 إصلاح ذاتي: إعادة تشغيل ${container.name}...`);

    try {
      const result = await this.docker.containerAction('start', container.id);
      
      if (result.success) {
        this.emit('heal', {
          type: 'container_restart',
          container: container.name,
          timestamp: new Date().toISOString()
        });

        console.log(`✅ تم إعادة تشغيل ${container.name}`);
      } else {
        this.emit('alert', {
          type: 'heal_failed',
          container: container.name,
          error: result.error
        });
      }

    } catch (error) {
      console.error(`❌ فشل إصلاح ${container.name}:`, error.message);
    }
  }

  /**
   * فحص قواعد البيانات
   */
  async checkDatabases() {
    const connections = this.database.getConnections();
    
    return {
      healthy: true,
      connected: connections.length,
      connections: connections
    };
  }

  /**
   * الحصول على المقاييس (مع Context Mode!)
   */
  async getMetrics() {
    const health = await this.checkHealth();

    // الحصول على سجلات النظام (ملخص فقط)
    const systemLogs = await this.contextMode.execute({
      language: 'shell',
      code: 'journalctl -u ai-agent --since "1 hour ago" -n 100',
      intent: 'errors warnings'
    });

    return {
      health,
      systemLogs: systemLogs.compressed ? systemLogs.summary : systemLogs.output,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  /**
   * إضافة مشترك للمقاييس (WebSocket)
   */
  addMetricsSubscriber(ws) {
    this.metricsSubscribers.add(ws);
  }

  /**
   * إزالة مشترك
   */
  removeMetricsSubscriber(ws) {
    this.metricsSubscribers.delete(ws);
  }

  /**
   * إرسال مقاييس للمشتركين
   */
  broadcastMetrics(metrics) {
    const message = JSON.stringify({
      type: 'metrics',
      data: metrics
    });

    this.metricsSubscribers.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(message);
      }
    });
  }

  /**
   * إيقاف المراقبة
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('⏹️ توقفت المراقبة');
    }
  }
}

export default SystemMonitor;
