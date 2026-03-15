# 🚀 Unified AI DevOps Platform v3.0

**منصة DevOps موحدة مدعومة بالذكاء الاصطناعي**  
تجمع بين قوة المراقبة التلقائية والإصلاح الذاتي مع ذكاء Claude AI المتقدم

---

## ✨ ما الجديد في v3.0؟

هذه النسخة تدمج **أفضل ميزات من مشروعين**:

### 🧠 من Advanced AI Agent:
- ✅ **ذاكرة ذكية** مع ضغط تلقائي للتوكنات
- ✅ **إدارة Docker متقدمة** (15+ أمر)
- ✅ **دعم قواعد بيانات متعددة** (PostgreSQL, MySQL, MongoDB, SQLite)
- ✅ **محلل أكواد قوي** (Linting, Complexity, Tests)
- ✅ **نظام Plugins** قابل للتوسع

### 🛡️ من AI DevOps Platform:
- ✅ **Monitoring كامل** (Prometheus + Grafana)
- ✅ **Self-Healing** - إصلاح ذاتي للحاويات
- ✅ **واجهة عربية** Mobile-Responsive
- ✅ **Gitea Integration** - Git خاص
- ✅ **CI/CD Pipelines** تلقائية
- ✅ **Security Scanning** (Trivy)

---

## 🎯 القدرات الكاملة

| الميزة | الوصف | الحالة |
|--------|--------|--------|
| **AI Chat** | دردشة ذكية بالعربية مع ذاكرة طويلة | ✅ |
| **Docker Management** | إدارة كاملة + مراقبة أداء | ✅ |
| **Multi-Database** | PostgreSQL, MySQL, MongoDB, SQLite | ✅ |
| **Code Analysis** | فحص أخطاء + توليد tests | ✅ |
| **Git Integration** | GitHub + Gitea API | ✅ |
| **Monitoring** | Prometheus + Grafana | ✅ |
| **Self-Healing** | إعادة تشغيل تلقائية | ✅ |
| **WebSocket** | تحديثات مباشرة | ✅ |
| **Memory System** | ضغط ذكي للسياق | ✅ |
| **Task Planner** | مهام معقدة متعددة الخطوات | ✅ |

---

## 📦 التثبيت السريع

### المتطلبات:
- Node.js 20+
- Docker & Docker Compose
- Raspberry Pi 4 (2GB+ RAM موصى به)

### الخطوات:

```bash
# 1. استنساخ/نسخ المشروع
cd ~
tar -xzf unified-ai-agent.tar.gz
cd unified-ai-agent

# 2. الإعداد
cp .env.example .env
nano .env  # أضف ANTHROPIC_API_KEY

# 3. التشغيل
docker-compose up -d

# 4. التحقق
curl http://localhost:5000/api/health
```

**جاهز! 🎉**

الآن يمكنك الوصول إلى:
- **AI Agent**: http://localhost:5000
- **Gitea**: http://localhost:3000
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090

---

## 🔧 API Documentation

### 1. AI Chat

```bash
POST /api/chat
{
  "message": "اعرض حاويات Docker",
  "sessionId": "user1"
}
```

**Response:**
```json
{
  "message": "لديك 5 حاويات:\n- unified-ai-agent (running)\n- gitea (running)...",
  "usage": { "input_tokens": 150, "output_tokens": 200 },
  "memoryStats": { "total_messages": 10, "total_tokens": 5000 }
}
```

### 2. Docker Operations

```bash
# List Containers
GET /api/docker/containers

# Container Action
POST /api/docker/start/container_id
POST /api/docker/stop/container_id
POST /api/docker/restart/container_id
```

### 3. Database

```bash
# Connect
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

# Query
POST /api/database/query
{
  "name": "mydb",
  "sql": "SELECT * FROM users LIMIT 10"
}
```

### 4. Code Analysis

```bash
POST /api/code/analyze
{
  "code": "function test() { var x = 1; console.log(x); }",
  "language": "javascript"
}
```

**Response:**
```json
{
  "linesOfCode": 1,
  "complexity": { "average": 1 },
  "lintResults": {
    "errors": 0,
    "warnings": 2,
    "issues": [
      { "line": 1, "message": "Use 'const' instead of 'var'" },
      { "line": 1, "message": "Remove console.log" }
    ]
  }
}
```

### 5. Monitoring

```bash
# Real-time Metrics
GET /api/metrics

# Health Check
GET /api/health

# System Stats
GET /api/stats
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
unified-ai-agent/
├── backend/
│   ├── server.js              # الخادم الرئيسي
│   └── plugins/
│       ├── MemorySystem.js    # الذاكرة الذكية
│       ├── DockerManager.js   # إدارة Docker
│       ├── DatabaseManager.js # قواعد البيانات
│       ├── CodeAnalyzer.js    # تحليل الأكواد
│       └── GitIntegration.js  # GitHub/Gitea
├── monitoring/
│   ├── SystemMonitor.js       # المراقبة + Self-Healing
│   └── prometheus.yml         # إعدادات Prometheus
├── frontend/
│   └── index.html             # الواجهة العربية
├── config/
│   └── Caddyfile              # Reverse Proxy
├── data/                      # البيانات المحلية
├── logs/                      # السجلات
└── docker-compose.yml         # التشغيل الكامل
```

---

## 🔐 الأمان

### ✅ ما تم تطبيقه:

1. **API Keys في `.env`** - لا تُشارك أبداً
2. **اتصالات قواعد بيانات آمنة**
3. **Docker socket محمي**
4. **CORS مُفعّل بحذر**
5. **Health checks منتظمة**

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
# أضف: 0 2 * * * tar -czf ~/backups/ai-$(date +\%Y\%m\%d).tar.gz ~/unified-ai-agent/data
```

---

## 🎯 أمثلة عملية

### مثال 1: مراقبة وإصلاح تلقائي

```bash
# النظام يراقب الحاويات كل دقيقة
# إذا توقفت حاوية:
# 1. يكتشف الفشل
# 2. يحاول إعادة التشغيل (حتى 3 محاولات)
# 3. يرسل تنبيه WebSocket
# 4. يسجل الحدث

# يمكنك رؤية السجلات:
docker-compose logs -f ai-agent
```

### مثال 2: تحليل كود من Git

```javascript
// 1. سحب كود من Gitea
POST /api/git/repos
{ "owner": "baljadrawy", "type": "gitea" }

// 2. تحليل الكود
POST /api/code/analyze
{ "code": "...", "language": "javascript" }

// 3. توليد tests تلقائياً
// النتيجة تتضمن اختبارات Jest جاهزة
```

### مثال 3: استعلامات ذكية

```bash
# اسأل بالعربية:
POST /api/chat
{
  "message": "كم حاوية عندي شغالة؟ وأيها تستهلك أكثر موارد؟"
}

# Claude سيستخدم:
# 1. docker.list للحصول على القائمة
# 2. docker.stats لكل حاوية
# 3. يحلل ويرد بالعربية
```

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

### المشكلة: استهلاك CPU عالي

```bash
# تقليل تكرار المراقبة
# في .env
HEALTH_CHECK_INTERVAL=120000  # كل دقيقتين بدلاً من دقيقة
```

---

## 📈 الأداء على Raspberry Pi 4

| العنصر | RAM | CPU | ملاحظات |
|--------|-----|-----|---------|
| AI Agent | ~200MB | 5-10% | عادي |
| Gitea | ~150MB | 2-5% | خفيف |
| Prometheus | ~100MB | 3-7% | مستقر |
| Grafana | ~80MB | 2-4% | خفيف |
| PostgreSQL | ~50MB | 1-3% | ممتاز |
| **المجموع** | **~600MB** | **15-30%** | **ممتاز** |

✅ **يعمل بكفاءة على Raspberry Pi 4 مع 2GB RAM**

---

## 🤝 المساهمة

المساهمات مرحب بها! الرجاء:

1. Fork المشروع
2. إنشاء branch: `git checkout -b feature/amazing`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing`
5. فتح Pull Request

---

## 📝 الترخيص

MIT License - استخدم بحرية!

---

## 👤 المطوّر

**Basim Al-Jadrawy**  
GitHub: [@baljadrawy](https://github.com/baljadrawy)

---

## 🙏 شكر خاص

- Claude AI من Anthropic
- Docker & Docker Compose
- Prometheus & Grafana
- مجتمع Open Source

---

Made with ❤️ in Saudi Arabia 🇸🇦
