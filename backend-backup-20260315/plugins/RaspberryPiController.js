/**
 * RaspberryPiController.js - التحكم الكامل في Raspberry Pi
 * يتيح لـ Claude إدارة النظام بأمان
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class RaspberryPiController {
  constructor() {
    this.safeCommands = new Set([
      // أوامر آمنة مسموح بها
      'vcgencmd', 'df', 'free', 'uptime', 'top', 'htop',
      'systemctl status', 'journalctl', 'dmesg',
      'ls', 'cat', 'grep', 'find', 'ps', 'netstat'
    ]);

    this.dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /dd\s+if=/, // dd if=
      /mkfs/, // format
      />\s*\/dev/, // redirect to device
      /fork\s*bomb/, // fork bomb
      /:()\{.*\}/, // bash fork bomb pattern
    ];

    this.lastStats = {};
  }

  /**
   * الحصول على معلومات النظام
   */
  async getSystemInfo() {
    try {
      const [cpu, memory, disk, temp, uptime] = await Promise.all([
        this._getCPUInfo(),
        this._getMemoryInfo(),
        this._getDiskInfo(),
        this._getTemperature(),
        this._getUptime()
      ]);

      return {
        success: true,
        data: {
          cpu,
          memory,
          disk,
          temperature: temp,
          uptime,
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * معلومات CPU
   */
  async _getCPUInfo() {
    try {
      // استخدام top للحصول على CPU usage
      const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'");
      const usage = parseFloat(stdout.trim());

      // معلومات CPU من /proc/cpuinfo
      const cpuinfo = await fs.readFile('/proc/cpuinfo', 'utf-8');
      const model = cpuinfo.match(/Model\s*:\s*(.+)/)?.[1] || 'Unknown';
      const cores = os.cpus().length;

      return {
        usage: usage.toFixed(1),
        cores,
        model: model.trim(),
        loadAverage: os.loadavg()
      };
    } catch (error) {
      return { usage: 0, cores: os.cpus().length, error: error.message };
    }
  }

  /**
   * معلومات الذاكرة
   */
  async _getMemoryInfo() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total: this._formatBytes(total),
      used: this._formatBytes(used),
      free: this._formatBytes(free),
      usagePercent: ((used / total) * 100).toFixed(1)
    };
  }

  /**
   * معلومات القرص
   */
  async _getDiskInfo() {
    try {
      const { stdout } = await execAsync("df -h / | tail -1");
      const parts = stdout.trim().split(/\s+/);

      return {
        filesystem: parts[0],
        total: parts[1],
        used: parts[2],
        available: parts[3],
        usagePercent: parts[4],
        mountPoint: parts[5]
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * درجة الحرارة
   */
  async _getTemperature() {
    try {
      const { stdout } = await execAsync('vcgencmd measure_temp');
      const temp = parseFloat(stdout.match(/temp=([0-9.]+)/)?.[1] || 0);
      
      return {
        celsius: temp.toFixed(1),
        fahrenheit: ((temp * 9/5) + 32).toFixed(1),
        status: temp > 70 ? 'حار ⚠️' : temp > 60 ? 'دافئ' : 'طبيعي ✅'
      };
    } catch (error) {
      // إذا فشل vcgencmd (ليس على Pi)
      return { celsius: 'N/A', fahrenheit: 'N/A', status: 'غير متاح' };
    }
  }

  /**
   * وقت التشغيل
   */
  async _getUptime() {
    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    return {
      seconds: uptimeSeconds,
      formatted: `${days}d ${hours}h ${minutes}m`,
      human: `${days} يوم، ${hours} ساعة، ${minutes} دقيقة`
    };
  }

  /**
   * الحصول على العمليات الجارية
   */
  async getProcesses(limit = 10) {
    try {
      const { stdout } = await execAsync(`ps aux --sort=-%mem | head -${limit + 1}`);
      const lines = stdout.trim().split('\n');
      const headers = lines[0].split(/\s+/);
      
      const processes = lines.slice(1).map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          user: parts[0],
          pid: parts[1],
          cpu: parts[2],
          mem: parts[3],
          command: parts.slice(10).join(' ')
        };
      });

      return { success: true, data: processes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * الحصول على السجلات
   */
  async getLogs(service = null, lines = 50) {
    try {
      let command;
      
      if (service) {
        // سجلات خدمة محددة
        command = `journalctl -u ${service} -n ${lines} --no-pager`;
      } else {
        // سجلات النظام العامة
        command = `journalctl -n ${lines} --no-pager`;
      }

      const { stdout } = await execAsync(command);
      
      return {
        success: true,
        data: {
          service: service || 'system',
          lines: stdout.trim().split('\n'),
          count: lines
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * إدارة الخدمات
   */
  async manageService(action, serviceName) {
    const allowedActions = ['status', 'start', 'stop', 'restart', 'enable', 'disable'];
    
    if (!allowedActions.includes(action)) {
      return { success: false, error: 'Action not allowed' };
    }

    // قائمة الخدمات المسموح بها فقط
    const allowedServices = [
      'docker', 'nginx', 'postgresql', 'redis',
      'grafana-server', 'prometheus'
    ];

    if (!allowedServices.includes(serviceName)) {
      return { 
        success: false, 
        error: 'Service not in whitelist',
        allowed: allowedServices 
      };
    }

    try {
      const command = `sudo systemctl ${action} ${serviceName}`;
      const { stdout, stderr } = await execAsync(command);

      return {
        success: true,
        data: {
          action,
          service: serviceName,
          output: stdout || stderr,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * معلومات الشبكة
   */
  async getNetworkInfo() {
    try {
      const interfaces = os.networkInterfaces();
      const result = {};

      for (const [name, addrs] of Object.entries(interfaces)) {
        result[name] = addrs
          .filter(addr => !addr.internal)
          .map(addr => ({
            address: addr.address,
            family: addr.family,
            mac: addr.mac
          }));
      }

      // إضافة معلومات الاتصال
      const { stdout: wifiInfo } = await execAsync('iwconfig 2>/dev/null || echo "N/A"');
      
      return {
        success: true,
        data: {
          interfaces: result,
          wifi: wifiInfo.includes('ESSID') ? 'متصل' : 'غير متصل'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * تنفيذ أمر آمن
   */
  async executeCommand(command) {
    // فحص الأمان
    const safetyCheck = this._checkCommandSafety(command);
    if (!safetyCheck.safe) {
      return { 
        success: false, 
        error: 'Unsafe command blocked',
        reason: safetyCheck.reason
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 10000, // 10 seconds max
        maxBuffer: 1024 * 1024 // 1MB max output
      });

      return {
        success: true,
        data: {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        exitCode: error.code
      };
    }
  }

  /**
   * فحص أمان الأمر
   */
  _checkCommandSafety(command) {
    // فحص الأنماط الخطرة
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return { 
          safe: false, 
          reason: `Dangerous pattern detected: ${pattern}` 
        };
      }
    }

    // فحص الكلمات الممنوعة
    const forbidden = ['rm -rf /', 'mkfs', 'dd if=', 'format', ':()'];
    for (const word of forbidden) {
      if (command.includes(word)) {
        return { 
          safe: false, 
          reason: `Forbidden keyword: ${word}` 
        };
      }
    }

    // فحص الأوامر المسموح بها فقط
    const commandStart = command.trim().split(/\s+/)[0];
    const allowed = [
      'ls', 'cat', 'grep', 'find', 'ps', 'top', 'htop',
      'df', 'free', 'uptime', 'vcgencmd', 'systemctl',
      'journalctl', 'dmesg', 'netstat', 'ifconfig', 'iwconfig'
    ];

    if (!allowed.includes(commandStart)) {
      return { 
        safe: false, 
        reason: `Command not in whitelist: ${commandStart}`,
        allowed 
      };
    }

    return { safe: true };
  }

  /**
   * تنسيق حجم البايتات
   */
  _formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * إنشاء تقرير صحة النظام
   */
  async getHealthReport() {
    const info = await this.getSystemInfo();
    if (!info.success) return info;

    const { cpu, memory, disk, temperature } = info.data;

    // تحديد الحالة
    const issues = [];
    const warnings = [];

    // فحص CPU
    if (parseFloat(cpu.usage) > 80) {
      issues.push(`CPU usage مرتفع: ${cpu.usage}%`);
    } else if (parseFloat(cpu.usage) > 60) {
      warnings.push(`CPU usage: ${cpu.usage}%`);
    }

    // فحص الذاكرة
    if (parseFloat(memory.usagePercent) > 85) {
      issues.push(`Memory usage مرتفع: ${memory.usagePercent}%`);
    } else if (parseFloat(memory.usagePercent) > 70) {
      warnings.push(`Memory usage: ${memory.usagePercent}%`);
    }

    // فحص القرص
    const diskUsage = parseFloat(disk.usagePercent);
    if (diskUsage > 90) {
      issues.push(`Disk usage مرتفع: ${disk.usagePercent}`);
    } else if (diskUsage > 80) {
      warnings.push(`Disk usage: ${disk.usagePercent}`);
    }

    // فحص درجة الحرارة
    const temp = parseFloat(temperature.celsius);
    if (temp > 70) {
      issues.push(`Temperature مرتفعة: ${temperature.celsius}°C`);
    } else if (temp > 60) {
      warnings.push(`Temperature: ${temperature.celsius}°C`);
    }

    // الحالة العامة
    let status = 'healthy';
    if (issues.length > 0) status = 'critical';
    else if (warnings.length > 0) status = 'warning';

    return {
      success: true,
      data: {
        status,
        statusEmoji: status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : '🔴',
        issues,
        warnings,
        metrics: {
          cpu: cpu.usage + '%',
          memory: memory.usagePercent + '%',
          disk: disk.usagePercent,
          temperature: temperature.celsius + '°C'
        },
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * مثال الاستخدام:
 * 
 * const pi = new RaspberryPiController();
 * 
 * // معلومات النظام
 * const info = await pi.getSystemInfo();
 * console.log(info.data);
 * 
 * // تقرير الصحة
 * const health = await pi.getHealthReport();
 * if (health.data.status === 'critical') {
 *   telegram.sendAlert('danger', 'تحذير', health.data.issues.join('\n'));
 * }
 * 
 * // تنفيذ أمر آمن
 * const result = await pi.executeCommand('df -h');
 * console.log(result.data.stdout);
 */
