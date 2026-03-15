import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class FileSystemPlugin {
  constructor(baseDir = '/app') {
    this.baseDir = baseDir;
    this.allowedDirs = [
      '/app/frontend',
      '/app/backend',
      '/app/config',
      '/app/data'
    ];
  }
  
  // قراءة بنية المشروع
  getProjectStructure() {
    try {
      const structure = {
        frontend: this.listDir('/app/frontend'),
        backend: this.listDir('/app/backend'),
        plugins: this.listDir('/app/backend/plugins'),
        apis: this.extractAPIs(),
        routes: this.extractRoutes()
      };
      
      return {
        success: true,
        data: structure
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // قراءة محتوى ملف
  readFile(filePath) {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      
      // تحقق من الأمان
      if (!this.isPathAllowed(fullPath)) {
        return {
          success: false,
          error: 'Access denied to this path'
        };
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);
      
      return {
        success: true,
        data: {
          path: filePath,
          content,
          size: stats.size,
          modified: stats.mtime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // كتابة/تعديل ملف
  writeFile(filePath, content) {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      
      if (!this.isPathAllowed(fullPath)) {
        return {
          success: false,
          error: 'Access denied to this path'
        };
      }
      
      // نسخة احتياطية
      if (fs.existsSync(fullPath)) {
        const backupPath = `${fullPath}.backup`;
        fs.copyFileSync(fullPath, backupPath);
      }
      
      fs.writeFileSync(fullPath, content, 'utf8');
      
      return {
        success: true,
        message: `File saved: ${filePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // إنشاء ملف جديد
  createFile(filePath, content = '') {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      
      if (!this.isPathAllowed(fullPath)) {
        return {
          success: false,
          error: 'Access denied to this path'
        };
      }
      
      if (fs.existsSync(fullPath)) {
        return {
          success: false,
          error: 'File already exists'
        };
      }
      
      // إنشاء المجلدات إذا لزم
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content, 'utf8');
      
      return {
        success: true,
        message: `File created: ${filePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // حذف ملف
  deleteFile(filePath) {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      
      if (!this.isPathAllowed(fullPath)) {
        return {
          success: false,
          error: 'Access denied'
        };
      }
      
      // نسخة احتياطية قبل الحذف
      const backupPath = `${fullPath}.deleted`;
      fs.renameSync(fullPath, backupPath);
      
      return {
        success: true,
        message: `File deleted: ${filePath} (backup: ${backupPath})`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // تنفيذ أوامر shell (محدودة)
  async executeCommand(command) {
    try {
      // قائمة بيضاء للأوامر المسموحة
      const allowedCommands = ['ls', 'cat', 'grep', 'find', 'wc', 'head', 'tail'];
      const firstWord = command.split(' ')[0];
      
      if (!allowedCommands.includes(firstWord)) {
        return {
          success: false,
          error: 'Command not allowed'
        };
      }
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.baseDir,
        timeout: 5000
      });
      
      return {
        success: true,
        data: {
          stdout,
          stderr
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Helper methods
  listDir(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      return items.filter(item => !item.startsWith('.'));
    } catch (error) {
      return [];
    }
  }
  
  extractAPIs() {
    try {
      const serverPath = '/app/backend/server.js';
      const content = fs.readFileSync(serverPath, 'utf8');
      
      // استخراج الـ routes
      const routes = [];
      const regex = /app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2]
        });
      }
      
      return routes;
    } catch (error) {
      return [];
    }
  }
  
  extractRoutes() {
    const apis = this.extractAPIs();
    return apis.map(api => `${api.method} ${api.path}`);
  }
  
  isPathAllowed(fullPath) {
    return this.allowedDirs.some(dir => fullPath.startsWith(dir));
  }
}
