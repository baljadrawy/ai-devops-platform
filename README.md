# 🚀 Unified AI DevOps Platform v3.0

**منصة DevOps موحدة مدعومة بالذكاء الاصطناعي مع قدرات Self-Coding!**  
تجمع بين قوة المراقبة التلقائية والإصلاح الذاتي مع ذكاء Claude AI المتقدم

---

## ✨ ما الجديد في v3.0؟

هذه النسخة تدمج **أفضل ميزات من مشروعين** + **ميزات جديدة ثورية**:

### 🧠 من Advanced AI Agent:

* ✅ **ذاكرة ذكية** مع ضغط تلقائي للتوكنات
* ✅ **إدارة Docker متقدمة** (15+ أمر)
* ✅ **دعم قواعد بيانات متعددة** (PostgreSQL, MySQL, MongoDB, SQLite)
* ✅ **محلل أكواد قوي** (Linting, Complexity, Tests)
* ✅ **نظام Plugins** قابل للتوسع

### 🛡️ من AI DevOps Platform:

* ✅ **Monitoring كامل** (Prometheus + Grafana)
* ✅ **Self-Healing** - إصلاح ذاتي للحاويات
* ✅ **واجهة عربية** Mobile-Responsive
* ✅ **Gitea Integration** - Git خاص
* ✅ **CI/CD Pipelines** تلقائية
* ✅ **Security Scanning** (Trivy)

### 🆕 ميزات حصرية في v3.0:

* ✅ **FileSystem Tools** - Claude يقرأ ويكتب الكود! 🔥
* ✅ **Self-Coding Platform** - المنصة تطور نفسها
* ✅ **Smart Context** - جمع معلومات تلقائي حسب السؤال
* ✅ **Telegram Integration** - إشعارات فورية لكل عملية
* ✅ **Execute Commands** - تنفيذ أوامر Shell آمنة

---

## 🎯 القدرات الكاملة

| الميزة | الوصف | الحالة |
| --- | --- | --- |
| **AI Chat** | دردشة ذكية بالعربية مع ذاكرة طويلة | ✅ |
| **🆕 FileSystem Tools** | قراءة/كتابة/تنفيذ ملفات | ✅ NEW! |
| **🆕 Self-Coding** | المنصة تطور نفسها بمساعدة AI | ✅ NEW! |
| **🆕 Smart Context** | جمع معلومات تلقائي | ✅ NEW! |
| **Docker Management** | إدارة كاملة + مراقبة أداء | ✅ |
| **Multi-Database** | PostgreSQL, MySQL, MongoDB, SQLite | ✅ |
| **Code Analysis** | فحص أخطاء + توليد tests | ✅ |
| **Git Integration** | GitHub + Gitea API | ✅ |
| **Monitoring** | Prometheus + Grafana | ✅ |
| **Self-Healing** | إعادة تشغيل تلقائية | ✅ |
| **WebSocket** | تحديثات مباشرة | ✅ |
| **Memory System** | ضغط ذكي للسياق | ✅ |
| **Telegram Bot** | إشعارات فورية | ✅ |
| **Task Planner** | مهام معقدة متعددة الخطوات | ✅ |

---

## 📦 التثبيت السريع

### المتطلبات:

* Node.js 20+
* Docker & Docker Compose
* Raspberry Pi 4 (2GB+ RAM موصى به)

### الخطوات:

```bash
# 1. استنساخ المشروع
git clone https://github.com/baljadrawy/ai-devops-platform.git
cd ai-devops-platform

# 2. الإعداد
cp .env.example .env
nano .env  # أضف ANTHROPIC_API_KEY و TELEGRAM_BOT_TOKEN

# 3. التشغيل
docker-compose up -d

# 4. التحقق
curl http://localhost:5000/api/health
```

**جاهز! 🎉**

الآن يمكنك الوصول إلى:

* **AI Agent**: http://localhost:5000
* **Gitea**: http://localhost:3100
* **Grafana**: http://localhost:3101
* **Prometheus**: http://localhost:9190
* **Reverse Proxy**: http://localhost:8080

---

## 🔧 API Documentation

### 1. AI Chat (مع Self-Coding!)

```bash
POST /api/chat
{
  "message": "اقرأ ملف server.js واشرح لي كيف يعمل نظام الذاكرة",
  "sessionId": "user1"
}
```

**Response:**

```json
{
  "message": "بالتأكيد! سأقرأ الملف الآن...\n\nنظام الذاكرة يعمل كالتالي:\n1. يحفظ كل رسالة مع تقدير tokens\n2. كل ساعة يفحص إذا تجاوز 100K tokens\n3. يضغط تلقائياً باستخدام Claude...",
  "usage": { 
    "input_tokens": 150, 
    "output_tokens": 500 
  }
}
```

**Claude الآن يستطيع:**
- 📖 قراءة أي ملف في المشروع
- ✏️ تعديل وإنشاء ملفات
- 🔧 تنفيذ أوامر shell
- 🏗️ تطوير ميزات جديدة!

---

### 🆕 2. FileSystem APIs

#### الحصول على بنية المشروع
```bash
GET /api/filesystem/structure
```

**Response:**
```json
{
  "success": true,
  "data": {
    "frontend": ["index.html", "chat.html", "docker.html"],
    "plugins": ["DockerManager.js", "DatabaseManager.js"],
    "routes": ["GET /api/health", "POST /api/chat"]
  }
}
```

#### قراءة ملف
```bash
POST /api/filesystem/read
{
  "path": "./backend/server.js"
}
```

#### تعديل ملف
```bash
POST /api/filesystem/write
{
  "path": "./frontend/index.html",
  "content": "<!DOCTYPE html>..."
}
```
✅ **تنبيه تلقائي على Telegram عند النجاح!**

#### إنشاء ملف جديد
```bash
POST /api/filesystem/create
{
  "path": "./frontend/monitoring.html",
  "content": "<!DOCTYPE html>..."
}
```

#### حذف ملف
```bash
DELETE /api/filesystem/delete
{
  "path": "./temp/old-file.txt"
}
```

#### تنفيذ أمر Shell
```bash
POST /api/filesystem/execute
{
  "command": "ls -la ./backend"
}
```
⚠️ **استخدم بحذر شديد!**

---

### 3. Docker Operations

```bash
# قائمة الحاويات
GET /api/docker/containers

# عمليات الحاويات
POST /api/docker/start/container_id
POST /api/docker/stop/container_id
POST /api/docker/restart/container_id
```

---

### 4. Database

```bash
# الاتصال
POST /api/database/connect
{
  "type": "postgres",
  "name": "mydb",
  "config": {
    "host": "postgres",
    "database": "aiagent",
    "user": "postgres",
    "password": "password"
  }
}

# استعلام
POST /api/database/query
{
  "name": "mydb",
  "sql": "SELECT * FROM users LIMIT 10"
}
```

---

### 5. Code Analysis

```bash
POST /api/code/analyze
{
  "code": "function test() { var x = 1; console.log(x); }",
  "language": "javascript"
}
```

---

### 6. Monitoring

```bash
# مقاييس فورية
GET /api/metrics

# فحص الصحة
GET /api/health

# إحصائيات النظام
GET /api/stats
```

---

### 7. Telegram Alerts

```bash
POST /api/telegram/alert
{
  "type": "success",  // success, warning, danger
  "title": "🎉 نجاح",
  "message": "تم رفع التحديث بنجاح!"
}
```

---

## 🌐 WebSocket للتحديثات المباشرة

```javascript
const ws = new WebSocket('ws://localhost:5000');

// الاشتراك في المقاييس
ws.send(JSON.stringify({
  type: 'subscribe_metrics'
}));

// استقبال التحديثات
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'alert') {
    console.log('تنبيه:', data.data);
  }
  
  if (data.type === 'heal') {
    console.log('إصلاح ذاتي:', data.data);
  }
  
  if (data.type === 'metrics') {
    console.log('مقاييس:', data.data);
  }
};
```

---

## 📊 البنية المعمارية

```
unified-platform-complete/
├── backend/
│   ├── server.js              # الخادم الرئيسي
│   └── plugins/
│       ├── MemorySystem.js    # الذاكرة الذكية
│       ├── DockerManager.js   # إدارة Docker
│       ├── DatabaseManager.js # قواعد البيانات
│       ├── CodeAnalyzer.js    # تحليل الأكواد
│       ├── GitIntegration.js  # GitHub/Gitea
│       ├── TelegramBot.js     # إشعارات Telegram
│       └── FileSystemPlugin.js # 🆕 قراءة/كتابة ملفات
├── frontend/
│   ├── index.html             # الصفحة الرئيسية
│   ├── chat.html              # دردشة AI
│   ├── docker.html            # إدارة Docker
│   ├── database.html          # قواعد البيانات
│   └── history.html           # سجل المحادثات
├── monitoring/
│   ├── SystemMonitor.js       # المراقبة + Self-Healing
│   ├── prometheus.yml         # إعدادات Prometheus
│   └── grafana-dashboards/    # لوحات Grafana
├── config/
│   └── Caddyfile              # Reverse Proxy
├── data/                      # البيانات المحلية
├── logs/                      # السجلات
├── docker-compose.yml         # التشغيل الكامل
└── .env.example               # متغيرات البيئة
```

---

## 🔐 الأمان

### ✅ ما تم تطبيقه:

1. **API Keys في `.env`** - لا تُشارك أبداً
2. **اتصالات قواعد بيانات آمنة**
3. **Docker socket محمي**
4. **CORS مُفعّل بحذر**
5. **FileSystem محدود بمسارات آمنة**
6. **أوامر Shell محمية من Fork Bombs**
7. **Health checks منتظمة**

### 🛡️ توصيات إضافية:

```bash
# تفعيل جدار الحماية
sudo ufw allow 22/tcp
sudo ufw allow 5000/tcp
sudo ufw enable

# تحديث منتظم
sudo apt update && sudo apt upgrade -y

# نسخ احتياطي يومي
crontab -e
# أضف:
0 2 * * * tar -czf ~/backups/ai-$(date +\%Y\%m\%d).tar.gz ~/unified-platform-complete/data
```

---

## 🎯 أمثلة عملية

### مثال 1: تطوير ميزة جديدة بمساعدة AI

```bash
POST /api/chat
{
  "message": "أريد إضافة صفحة جديدة لمراقبة CPU/Memory بالوقت الفعلي"
}
```

**Claude سيقوم بـ:**
1. ✅ قراءة `frontend/index.html` كمرجع
2. ✅ إنشاء `frontend/monitoring.html` بتصميم مطابق
3. ✅ إضافة WebSocket endpoint في `server.js`
4. ✅ تحديث navigation
5. ✅ **يطلب منك التأكيد قبل التنفيذ!**

---

### مثال 2: مراجعة وتحسين الكود

```bash
POST /api/chat
{
  "message": "راجع ملفات backend/plugins/ وأعطني تقرير عن جودة الكود"
}
```

**Claude سيقوم بـ:**
1. قراءة كل ملفات Plugins
2. تحليل:
   - Code complexity
   - Best practices
   - Performance issues
   - Security vulnerabilities
3. اقتراح تحسينات محددة

---

### مثال 3: إصلاح خطأ تلقائي

```bash
POST /api/chat
{
  "message": "لاحظت خطأ في docker.html عند عرض الحاويات، هل يمكنك إصلاحه؟"
}
```

**Claude سيقوم بـ:**
1. قراءة `frontend/docker.html`
2. تحليل الكود وإيجاد الخطأ
3. اقتراح الإصلاح
4. **يطلب الإذن للتطبيق**
5. تطبيق التعديل وإرسال تنبيه Telegram

---

### مثال 4: مراقبة وإصلاح تلقائي

```bash
# النظام يراقب الحاويات كل دقيقة
# إذا توقفت حاوية:
# 1. ✅ يكتشف الفشل
# 2. ✅ يحاول إعادة التشغيل (حتى 3 محاولات)
# 3. ✅ يرسل تنبيه WebSocket + Telegram
# 4. ✅ يسجل الحدث

# يمكنك رؤية السجلات:
docker-compose logs -f ai-agent
```

---

### مثال 5: استعلامات ذكية

```bash
POST /api/chat
{
  "message": "كم حاوية عندي شغالة؟ وأيها تستهلك أكثر موارد؟"
}
```

**Claude سيقوم بـ:**
1. استخدام `docker.listContainers()` للحصول على القائمة
2. استخدام `docker.getStats()` لكل حاوية
3. تحليل البيانات
4. الرد بالعربية بشكل منظم

---

## 🔧 Troubleshooting

### المشكلة: الذاكرة ممتلئة

```bash
# تنظيف الذاكرة القديمة
sqlite3 ./data/memory.db "DELETE FROM conversations WHERE timestamp < datetime('now', '-7 days');"

# أو في .env
COMPRESSION_THRESHOLD=50000  # تقليل الحد
```

### المشكلة: Docker plugin لا يعمل

```bash
# التحقق من الصلاحيات
sudo usermod -aG docker $USER
# إعادة تسجيل الدخول
```

### المشكلة: FileSystem Permission Denied

```bash
# إصلاح الصلاحيات
sudo chown -R pi:pi ~/unified-platform-complete
chmod -R 755 ~/unified-platform-complete
```

### المشكلة: استهلاك CPU عالي

```bash
# تقليل تكرار المراقبة
# في .env
HEALTH_CHECK_INTERVAL=120000  # كل دقيقتين بدلاً من دقيقة
```

---

## 📈 الأداء على Raspberry Pi 4

| العنصر | RAM | CPU | ملاحظات |
| --- | --- | --- | --- |
| AI Agent | ~150-200MB | 5-15% | عادي |
| Gitea | ~150MB | 2-5% | خفيف |
| Prometheus | ~100-150MB | 3-7% | مستقر |
| Grafana | ~80-120MB | 2-4% | خفيف |
| PostgreSQL | ~50-80MB | 1-3% | ممتاز |
| Caddy | ~20-30MB | <1% | خفيف جداً |
| **المجموع** | **~550-730MB** | **13-35%** | **ممتاز** |

✅ **يعمل بكفاءة على Raspberry Pi 4 مع 2GB RAM**

---

## 🚀 الميزات الخفية

### 1. Auto-Compression
```javascript
// كل ساعة: يفحص الجلسات
// إذا >100K tokens → يضغط تلقائياً!
setInterval(async () => {
  await memory.compressAndGetContext(sessionId, 100000);
}, 3600000);
```

### 2. Auto-Cleanup
```javascript
// كل 24 ساعة: يحذف المحادثات القديمة >7 أيام
setInterval(() => {
  const deleted = memory.cleanup(7);
}, 86400000);
```

### 3. Smart Monitoring
```javascript
// كل 30 ثانية: يراقب
// - درجة الحرارة (>70°C → تنبيه Telegram)
// - الذاكرة (>400MB → تنبيه Telegram)
// - CPU (>80% → تنبيه Telegram)
```

---

## 🤝 المساهمة

المساهمات مرحب بها! الرجاء:

1. Fork المشروع
2. إنشاء branch: `git checkout -b feature/amazing`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing`
5. فتح Pull Request

---

## 📚 الوثائق الإضافية

- [FileSystem Plugin Documentation](./FILESYSTEM-PLUGIN-DOCS.md)
- [API Reference (Coming Soon)](./API-DOCS.md)
- [Architecture Guide (Coming Soon)](./ARCHITECTURE.md)
- [Deployment Guide (Coming Soon)](./DEPLOYMENT.md)

---

## 📝 الترخيص

MIT License - استخدم بحرية!

---

## 👤 المطوّر

**Basim Al-Jadrawy**  
GitHub: [@baljadrawy](https://github.com/baljadrawy)

---

## 🙏 شكر خاص

* Claude AI من Anthropic - القلب النابض للمنصة
* Docker & Docker Compose - البنية التحتية
* Prometheus & Grafana - المراقبة الاحترافية
* مجتمع Open Source - الدعم المستمر

---

## 🎯 خارطة الطريق

### v3.1 (القادمة):
- [ ] File versioning (Git-like)
- [ ] Auto-backup قبل كل تعديل
- [ ] Multi-Agent Architecture
- [ ] Kubernetes support
- [ ] Mobile app للمراقبة

### v3.2 (مستقبلية):
- [ ] Real-time collaboration
- [ ] Cloud backup integration
- [ ] Advanced security scanning
- [ ] Performance optimization AI

---

**Made with ❤️ in Saudi Arabia 🇸🇦**

*"المنصة الوحيدة التي تطور نفسها!"* 🚀
