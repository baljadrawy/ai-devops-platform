# 🔒 ملف الإصلاحات الأمنية
**الأولوية:** حرجة
**التاريخ:** 2026-04-03

---

## 🚨 الإصلاح #1: Shell Injection في `executeCommand`

### المشكلة
```javascript
// ❌ الكود الحالي - خطير جداً
async executeCommand(command) {
  const allowedCommands = ['ls', 'cat', 'grep', 'find', 'wc', 'head', 'tail'];
  const firstWord = command.split(' ')[0];
  if (!allowedCommands.includes(firstWord)) { ... }

  const { stdout, stderr } = await execAsync(command, { ... });
}
```

### الهجوم الممكن
```bash
# يُمرر الأمر: "ls; rm -rf /app"
# يتم التحقق من "ls" فقط ✓
# يتم تنفيذ كلا الأمرين: ls و rm -rf /app ❌
```

### ✅ الإصلاح الكامل

```javascript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async executeCommand(command) {
  try {
    // 1️⃣ التحقق من الأحرف الخطيرة
    const dangerousPatterns = /[;&|`$(){}[\]<>\\!*?~]/;
    if (dangerousPatterns.test(command)) {
      return {
        success: false,
        error: '❌ أحرف غير مسموحة: ; & | ` $ ( ) { } [ ] < > \\ ! * ? ~'
      };
    }

    // 2️⃣ تقسيم الأمر بشكل آمن
    const parts = command.trim().split(/\s+/);
    if (parts.length === 0) {
      return { success: false, error: '❌ أمر فارغ' };
    }

    const commandName = parts[0];
    const args = parts.slice(1);

    // 3️⃣ التحقق من قائمة الأوامر المسموحة
    const allowedCommands = {
      'ls': { desc: 'عرض الملفات', maxArgs: 5 },
      'cat': { desc: 'قراءة ملف', maxArgs: 1 },
      'grep': { desc: 'البحث في نص', maxArgs: 10 },
      'find': { desc: 'البحث عن ملفات', maxArgs: 5 },
      'wc': { desc: 'عد الكلمات', maxArgs: 1 },
      'head': { desc: 'أول أسطر', maxArgs: 2 },
      'tail': { desc: 'آخر أسطر', maxArgs: 2 }
    };

    if (!allowedCommands[commandName]) {
      return {
        success: false,
        error: `❌ أمر غير مسموح: ${commandName}\nالأوامر المسموحة: ${Object.keys(allowedCommands).join(', ')}`
      };
    }

    // 4️⃣ التحقق من عدد المعاملات
    const cmdConfig = allowedCommands[commandName];
    if (args.length > cmdConfig.maxArgs) {
      return {
        success: false,
        error: `❌ عدد معاملات كثير. الحد الأقصى: ${cmdConfig.maxArgs}`
      };
    }

    // 5️⃣ التحقق من صحة المسارات في المعاملات
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

    // 6️⃣ تنفيذ الأمر بدون shell (الطريقة الآمنة)
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
```

---

## 🚨 الإصلاح #2: Path Traversal في `FileSystemPlugin`

### ❌ المشكلة
```javascript
isPathAllowed(fullPath) {
  return this.allowedDirs.some(dir => fullPath.startsWith(dir));
}

// المشكلة:
// path.join('/app', '../../etc/passwd') قد لا يُحوَّل بشكل صحيح في جميع الحالات
// ولا يوجد فحص `listDir` على الإطلاق
```

### ✅ الإصلاح الكامل

```javascript
import path from 'path';
import fs from 'fs';

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

  /**
   * التحقق الآمن من المسار
   */
  isPathAllowed(filePath) {
    try {
      // 1️⃣ تطبيع المسار بالكامل
      const fullPath = path.resolve(this.baseDir, filePath);

      // 2️⃣ التأكد من أن المسار يقع داخل المجلدات المسموحة
      return this.allowedDirs.some(dir => {
        return fullPath === dir || fullPath.startsWith(dir + path.sep);
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * قراءة ملف - محسّن
   */
  readFile(filePath) {
    try {
      // 1️⃣ التحقق من صحة المدخلات
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: '❌ مسار غير صحيح' };
      }

      // 2️⃣ التحقق من الصلاحيات
      if (!this.isPathAllowed(filePath)) {
        return { success: false, error: '❌ لا توجد صلاحية للوصول إلى هذا المسار' };
      }

      const fullPath = path.resolve(this.baseDir, filePath);

      // 3️⃣ التحقق من أن الملف موجود وليس مجلد
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        return { success: false, error: '❌ هذا مجلد وليس ملف' };
      }

      // 4️⃣ التحقق من حجم الملف (منع قراءة ملفات ضخمة)
      const maxSize = 10 * 1024 * 1024; // 10 MB
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

  /**
   * عرض محتويات المجلد - محسّن
   */
  listDir(dirPath) {
    try {
      // 1️⃣ التحقق من صحة المدخلات
      if (!dirPath || typeof dirPath !== 'string') {
        return { success: false, error: '❌ مسار غير صحيح' };
      }

      // 2️⃣ التحقق من الصلاحيات ⭐ الجديد
      if (!this.isPathAllowed(dirPath)) {
        return { success: false, error: '❌ لا توجد صلاحية للوصول إلى هذا المجلد' };
      }

      const fullPath = path.resolve(this.baseDir, dirPath);

      // 3️⃣ التحقق من أن المسار مجلد
      const stats = fs.statSync(fullPath);
      if (!stats.isDirectory()) {
        return { success: false, error: '❌ هذا ملف وليس مجلد' };
      }

      const items = fs.readdirSync(fullPath);

      return {
        success: true,
        data: items.map(item => {
          const itemPath = path.join(fullPath, item);
          const itemStats = fs.statSync(itemPath);
          return {
            name: item,
            type: itemStats.isDirectory() ? 'dir' : 'file',
            size: itemStats.size,
            modified: itemStats.mtime,
            permissions: itemStats.mode.toString(8)
          };
        })
      };
    } catch (error) {
      return { success: false, error: `❌ ${error.message}` };
    }
  }

  /**
   * كتابة ملف - محسّن
   */
  writeFile(filePath, content) {
    try {
      // 1️⃣ التحقق من صحة المدخلات
      if (!filePath || !content) {
        return { success: false, error: '❌ مسار أو محتوى فارغ' };
      }

      // 2️⃣ التحقق من الصلاحيات
      if (!this.isPathAllowed(filePath)) {
        return { success: false, error: '❌ لا توجد صلاحية للكتابة إلى هذا المسار' };
      }

      const fullPath = path.resolve(this.baseDir, filePath);

      // 3️⃣ إنشاء نسخة احتياطية
      if (fs.existsSync(fullPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${fullPath}.backup.${timestamp}`;
        fs.copyFileSync(fullPath, backupPath);
      }

      // 4️⃣ كتابة الملف
      fs.writeFileSync(fullPath, content, 'utf8');

      return {
        success: true,
        message: `✅ تم حفظ الملف: ${filePath}`,
        size: content.length
      };
    } catch (error) {
      return { success: false, error: `❌ ${error.message}` };
    }
  }

  /**
   * حذف ملف - محسّن
   */
  deleteFile(filePath) {
    try {
      // 1️⃣ التحقق من صحة المدخلات
      if (!filePath) {
        return { success: false, error: '❌ مسار فارغ' };
      }

      // 2️⃣ التحقق من الصلاحيات
      if (!this.isPathAllowed(filePath)) {
        return { success: false, error: '❌ لا توجد صلاحية لحذف هذا الملف' };
      }

      const fullPath = path.resolve(this.baseDir, filePath);

      // 3️⃣ التحقق من وجود الملف
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: '❌ الملف غير موجود' };
      }

      // 4️⃣ نقل الملف إلى سلة بدلاً من الحذف الدائم
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const trashPath = `/app/data/.trash/${path.basename(fullPath)}.${timestamp}`;

      fs.renameSync(fullPath, trashPath);

      return {
        success: true,
        message: `✅ تم حذف الملف: ${filePath}`,
        trashPath: trashPath
      };
    } catch (error) {
      return { success: false, error: `❌ ${error.message}` };
    }
  }
}
```

---

## 🚨 الإصلاح #3: إضافة Authentication

### ✅ إنشاء Middleware للتحقق

```javascript
// في server.js

// 1️⃣ إضافة dotenv في البداية
import 'dotenv/config';

// 2️⃣ إنشاء Middleware للمصادقة
function requireAuth(req, res, next) {
  // السماح بـ health check بدون مصادقة
  if (req.path === '/api/health') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.warn('⚠️  تحذير: API_KEY غير مضبوطة في .env');
    return res.status(500).json({
      error: 'خادم غير مكتمل التكوين'
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({
      error: '❌ مفتاح API غير صحيح',
      hint: 'استخدم header: X-API-Key أو query param: ?apiKey=...'
    });
  }

  next();
}

// 3️⃣ تطبيق Middleware على المسارات الحساسة
app.post('/api/filesystem/write', requireAuth, (req, res) => { ... });
app.delete('/api/filesystem/delete', requireAuth, (req, res) => { ... });
app.post('/api/filesystem/execute', requireAuth, (req, res) => { ... });
app.post('/api/filesystem/create', requireAuth, (req, res) => { ... });
app.post('/api/chat', requireAuth, async (req, res) => { ... });
app.post('/api/database/query', requireAuth, async (req, res) => { ... });
app.post('/api/docker/:action/:id', requireAuth, async (req, res) => { ... });
```

### تحديث `.env.example`

```bash
# إضافة هذا السطر
API_KEY=your_secure_random_key_here_change_this
```

### توليد مفتاح API آمن

```bash
# في terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚨 الإصلاح #4: Rate Limiting

### ✅ التطبيق

```javascript
import rateLimit from 'express-rate-limit';

// تحديد حدود مختلفة لأنواع مختلفة من الطلبات
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 100, // 100 طلب لكل IP
  message: { error: '❌ طلبات كثيرة جداً، حاول لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 20, // 20 طلب فقط للـ chat
  message: { error: '❌ طلبات متكررة كثيرة، انتظر دقيقة' },
  skip: (req) => {
    // السماح بطلب واحد في الثانية من نفس sessionId
    return false;
  }
});

const fileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50, // 50 طلب للملفات
  message: { error: '❌ عمليات كثيرة على الملفات' }
});

// التطبيق
app.use('/api/', generalLimiter);
app.post('/api/chat', chatLimiter, requireAuth, async (req, res) => { ... });
app.post('/api/filesystem/:action', fileLimiter, requireAuth, (req, res) => { ... });
```

---

## 🚨 الإصلاح #5: Graceful Shutdown

### ✅ إضافة في نهاية server.js

```javascript
// تنظيف الموارد عند الإيقاف
process.on('SIGTERM', async () => {
  console.log('🛑 استقبال SIGTERM - بدء الإيقاف الآمن...');

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
```

---

## ✅ خطوات التطبيق

1. **النسخ الاحتياطية أولاً**
   ```bash
   cp -r backend backend.backup.$(date +%Y%m%d)
   ```

2. **تطبيق الإصلاحات**
   - استبدل `FileSystemPlugin.js` بالكود الجديد
   - استبدل `server.js` الأجزاء المتعلقة بـ `executeCommand` والـ middleware
   - أضف `express-rate-limit` إلى package.json

3. **تحديث .env**
   ```bash
   # توليد مفتاح API جديد
   API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   echo "API_KEY=$API_KEY" >> .env
   ```

4. **الاختبار**
   ```bash
   npm install
   npm start
   ```

5. **التحقق من الأمان**
   - جرب الأوامر بدون API_KEY (يجب أن يرفعها)
   - جرب Shell Injection: `ls; echo hacked` (يجب أن يرفعها)
   - جرب Path Traversal: `../../etc/passwd` (يجب أن يرفعها)

---

*تم إنشاء هذا الملف لضمان أمان المشروع* 🔒
