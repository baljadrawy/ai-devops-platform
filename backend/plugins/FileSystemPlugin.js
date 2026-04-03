import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class FileSystemPlugin {
  constructor(baseDir = '/app') {
    this.baseDir = path.resolve(baseDir);
    this.allowedDirs = [
      path.resolve('/app'),
      path.resolve('/app/frontend'),
      path.resolve('/app/backend'),
      path.resolve('/app/config'),
      path.resolve('/app/data')
    ];
  }

  getProjectStructure() {
    try {
      const structure = {
        frontend: this.listDir('/app/frontend'),
        backend: this.listDir('/app/backend'),
        plugins: this.listDir('/app/backend/plugins'),
        apis: this.extractAPIs(),
        routes: this.extractRoutes()
      };
      return { success: true, data: structure };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  readFile(filePath) {
    try {
      // ✅ فحص صحة المدخلات
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: '❌ مسار غير صحيح' };
      }

      const fullPath = path.resolve(this.baseDir, filePath);

      // ✅ فحص الصلاحيات
      if (!this.isPathAllowed(fullPath)) {
        return { success: false, error: '❌ لا توجد صلاحية للوصول إلى هذا المسار' };
      }

      // ✅ فحص وجود الملف
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: '❌ الملف غير موجود' };
      }

      const stats = fs.statSync(fullPath);

      // ✅ فحص أنه ملف وليس مجلد
      if (stats.isDirectory()) {
        return { success: false, error: '❌ هذا مجلد وليس ملف' };
      }

      // ✅ حد أقصى لحجم الملفات (10 MB)
      const maxSize = 10 * 1024 * 1024;
      if (stats.size > maxSize) {
        return {
          success: false,
          error: `❌ الملف كبير جداً (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
        };
      }

      const content = fs.readFileSync(fullPath, 'utf8');

      return {
        success: true,
        data: {
          path: filePath,
          content,
          size: stats.size,
          modified: stats.mtime,
          isFile: true
        }
      };
    } catch (error) {
      return { success: false, error: `❌ ${error.message}` };
    }
  }

  writeFile(filePath, content) {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      
      if (!this.isPathAllowed(fullPath)) {
        return { success: false, error: 'Access denied to this path' };
      }

      if (fs.existsSync(fullPath)) {
        const backupPath = `${fullPath}.backup`;
        fs.copyFileSync(fullPath, backupPath);
      }

      fs.writeFileSync(fullPath, content, 'utf8');
      return { success: true, message: `File saved: ${filePath}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  createFile(filePath, content) {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      
      if (!this.isPathAllowed(fullPath)) {
        return { success: false, error: 'Access denied to this path' };
      }

      if (fs.existsSync(fullPath)) {
        return { success: false, error: 'File already exists' };
      }

      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf8');
      return { success: true, message: `File created: ${filePath}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  deleteFile(filePath) {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      
      if (!this.isPathAllowed(fullPath)) {
        return { success: false, error: 'Access denied' };
      }

      const backupPath = `${fullPath}.deleted`;
      fs.renameSync(fullPath, backupPath);
      return { success: true, message: `File deleted: ${filePath} (backup: ${backupPath})` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  listDir(dirPath) {
    try {
      // ✅ فحص صحة المدخلات
      if (!dirPath || typeof dirPath !== 'string') {
        return [];
      }

      const fullPath = path.resolve(this.baseDir, dirPath);

      // ✅ فحص الصلاحيات
      if (!this.isPathAllowed(fullPath)) {
        return [];
      }

      // ✅ فحص وجود المجلد
      if (!fs.existsSync(fullPath)) {
        return [];
      }

      const stats = fs.statSync(fullPath);

      // ✅ فحص أنه مجلد
      if (!stats.isDirectory()) {
        return [];
      }

      const items = fs.readdirSync(fullPath);
      return items.map(item => {
        const itemPath = path.join(fullPath, item);
        const itemStats = fs.statSync(itemPath);
        return {
          name: item,
          type: itemStats.isDirectory() ? 'dir' : 'file',
          size: itemStats.size,
          modified: itemStats.mtime,
          permissions: itemStats.mode.toString(8)
        };
      });
    } catch (error) {
      return [];
    }
  }

  async executeCommand(command) {
    try {
      // 1️⃣ فحص صحة المدخلات
      if (!command || typeof command !== 'string' || command.trim().length === 0) {
        return { success: false, error: '❌ أمر فارغ' };
      }

      // 2️⃣ فحص الأحرف الخطيرة (منع Shell Injection)
      const dangerousPatterns = /[;&|`$(){}[\]<>\\!*?~]/;
      if (dangerousPatterns.test(command)) {
        return {
          success: false,
          error: '❌ أحرف غير مسموحة في الأمر: ; & | ` $ ( ) { } [ ] < > \\ ! * ? ~'
        };
      }

      // 3️⃣ تقسيم الأمر بشكل آمن
      const parts = command.trim().split(/\s+/);
      const commandName = parts[0];
      const args = parts.slice(1);

      // 4️⃣ قائمة الأوامر المسموحة مع حد أقصى للمعاملات
      const allowedCommands = {
        'ls': { desc: 'عرض الملفات', maxArgs: 5 },
        'cat': { desc: 'قراءة ملف', maxArgs: 1 },
        'grep': { desc: 'البحث في نص', maxArgs: 10 },
        'find': { desc: 'البحث عن ملفات', maxArgs: 5 },
        'wc': { desc: 'عد الكلمات', maxArgs: 1 },
        'head': { desc: 'أول أسطر', maxArgs: 2 },
        'tail': { desc: 'آخر أسطر', maxArgs: 2 }
      };

      // 5️⃣ فحص الأمر
      if (!allowedCommands[commandName]) {
        return {
          success: false,
          error: `❌ أمر غير مسموح: ${commandName}\nالأوامر المسموحة: ${Object.keys(allowedCommands).join(', ')}`
        };
      }

      // 6️⃣ فحص عدد المعاملات
      const cmdConfig = allowedCommands[commandName];
      if (args.length > cmdConfig.maxArgs) {
        return {
          success: false,
          error: `❌ عدد معاملات كثير. الحد الأقصى: ${cmdConfig.maxArgs}`
        };
      }

      // 7️⃣ فحص صحة المسارات في المعاملات
      for (const arg of args) {
        if (arg.includes('..')) {
          return {
            success: false,
            error: '❌ لا يُسمح بـ ".." في المسارات'
          };
        }
        if (arg.startsWith('/')) {
          return {
            success: false,
            error: '❌ لا يُسمح بالمسارات المطلقة'
          };
        }
      }

      // 8️⃣ تنفيذ الأمر بدون shell (الطريقة الآمنة)
      const { stdout, stderr } = await execFileAsync(commandName, args, {
        cwd: this.baseDir,
        timeout: 5000,
        maxBuffer: 1024 * 1024 // 1 MB max output
      });

      return {
        success: true,
        output: stdout,
        error: stderr || null,
        command: `${commandName} ${args.join(' ')}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  extractAPIs() {
    try {
      const serverPath = path.join(this.baseDir, 'backend/server.js');
      const content = fs.readFileSync(serverPath, 'utf8');
      const apiRegex = /app\.(get|post|put|delete)\(['"]([^'"]+)['"]/g;
      const apis = [];
      let match;
      
      while ((match = apiRegex.exec(content)) !== null) {
        apis.push({ method: match[1].toUpperCase(), path: match[2] });
      }
      
      return apis;
    } catch (error) {
      return [];
    }
  }

  extractRoutes() {
    return this.extractAPIs();
  }

  isPathAllowed(filePath) {
    try {
      // تطبيع المسار بالكامل
      const fullPath = path.resolve(this.baseDir, filePath);

      // التأكد من أن المسار يقع داخل المجلدات المسموحة
      return this.allowedDirs.some(dir => {
        return fullPath === dir || fullPath.startsWith(dir + path.sep);
      });
    } catch (error) {
      return false;
    }
  }
}
