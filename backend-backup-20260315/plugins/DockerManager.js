import Docker from 'dockerode';
import ContextModeWrapper from '../utils/ContextModeWrapper.js';

/**
 * Docker Manager مع Context Mode
 * يوفر 99% من التوكنات في عرض اللوغات
 */
export class DockerManager {
  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    this.contextMode = new ContextModeWrapper();
    this.name = 'docker';
  }

  /**
   * عرض الحاويات
   */
  async listContainers({ all = true } = {}) {
    try {
      const containers = await this.docker.listContainers({ all });
      
      return {
        success: true,
        data: containers.map(c => ({
          id: c.Id.substring(0, 12),
          name: c.Names[0].replace('/', ''),
          image: c.Image,
          state: c.State,
          status: c.Status,
          created: new Date(c.Created * 1000).toISOString()
        })),
        count: containers.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * الحصول على سجلات حاوية (مع Context Mode!)
   */
  async getContainerLogs({ containerId, tail = 100, intent = 'errors warnings' }) {
    try {
      // استخدام Context Mode بدلاً من قراءة اللوغات مباشرة
      const result = await this.contextMode.execute({
        language: 'shell',
        code: `docker logs ${containerId} --tail ${tail} 2>&1`,
        intent: intent
      });

      if (result.compressed) {
        return {
          success: true,
          summary: result.summary,
          savings: result.savings,
          mode: 'context-mode',
          message: `تم ضغط ${result.originalSize} bytes إلى ${result.size} bytes`
        };
      }

      return {
        success: true,
        logs: result.output,
        mode: 'raw'
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * إحصائيات الحاوية (مع ملخص ذكي)
   */
  async getContainerStats({ containerId }) {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });

      // حساب استخدام CPU
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                      stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - 
                         stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuDelta / systemDelta) * 
                        stats.cpu_stats.online_cpus * 100;

      // حساب استخدام الذاكرة
      const memUsage = stats.memory_stats.usage;
      const memLimit = stats.memory_stats.limit;
      const memPercent = (memUsage / memLimit) * 100;

      // ملخص مختصر فقط
      return {
        success: true,
        data: {
          cpu: cpuPercent.toFixed(2) + '%',
          memory: {
            usage: this.formatBytes(memUsage),
            percent: memPercent.toFixed(2) + '%'
          }
        },
        mode: 'summary'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * عمليات الحاوية
   */
  async containerAction(action, containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      
      switch (action) {
        case 'start':
          await container.start();
          break;
        case 'stop':
          await container.stop({ t: 10 });
          break;
        case 'restart':
          await container.restart({ t: 10 });
          break;
        case 'remove':
          await container.remove({ force: true });
          break;
        default:
          return { success: false, error: `عملية غير معروفة: ${action}` };
      }

      return {
        success: true,
        message: `تم ${action} الحاوية ${containerId} بنجاح`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * تنسيق الحجم
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export default DockerManager;
