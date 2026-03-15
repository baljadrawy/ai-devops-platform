import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class FileSystemPlugin {
  constructor(baseDir = '/app') {
    this.baseDir = baseDir;
    this.allowedDirs = [
      '/app',
      '/app/frontend',
      '/app/backend',
      '/app/config',
      '/app/data'
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
      const fullPath = path.join(this.baseDir, filePath);
      
      if (!this.isPathAllowed(fullPath)) {
        return { success: false, error: 'Access denied to this path' };
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
      return { success: false, error: error.message };
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
      const fullPath = path.join(this.baseDir, dirPath);
      const items = fs.readdirSync(fullPath);
      return items.map(item => {
        const itemPath = path.join(fullPath, item);
        const stats = fs.statSync(itemPath);
        return {
          name: item,
          type: stats.isDirectory() ? 'dir' : 'file',
          size: stats.size,
          modified: stats.mtime
        };
      });
    } catch (error) {
      return [];
    }
  }

  async executeCommand(command) {
    try {
      const allowedCommands = ['ls', 'cat', 'grep', 'find', 'wc', 'head', 'tail'];
      const firstWord = command.split(' ')[0];

      if (!allowedCommands.includes(firstWord)) {
        return { success: false, error: 'Command not allowed' };
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.baseDir,
        timeout: 5000
      });

      return { success: true, output: stdout, error: stderr };
    } catch (error) {
      return { success: false, error: error.message };
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

  isPathAllowed(fullPath) {
    return this.allowedDirs.some(dir => fullPath.startsWith(dir));
  }
}
