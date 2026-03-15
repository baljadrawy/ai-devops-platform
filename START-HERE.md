# 🚀 دليل التشغيل السريع - 3 خطوات فقط!

## 1️⃣ الإعداد (دقيقة واحدة)

```bash
cd ~/unified-platform-complete

# نسخ ملف الإعدادات
cp .env.example .env

# تعديله
nano .env
```

**أضف فقط:**
- `ANTHROPIC_API_KEY=sk-ant-...` (المفتاح حقك)
- `POSTGRES_PASSWORD=أي_كلمة_مرور`

احفظ: `Ctrl+X` ثم `Y` ثم `Enter`

---

## 2️⃣ التثبيت (10 دقائق)

```bash
# تثبيت التبعيات
npm install

# تشغيل Docker
docker-compose up -d
```

---

## 3️⃣ التحقق

```bash
curl http://localhost:5000/api/health
```

**إذا شفت `"status": "healthy"`** = **نجح! 🎉**

---

## 🌐 الوصول

افتح المتصفح:
- **المنصة**: http://raspberrypi.local:5000
- **Grafana**: http://raspberrypi.local:3001 (admin/admin)
- **Gitea**: http://raspberrypi.local:3000

---

## 🆘 مشاكل؟

```bash
# السجلات
docker-compose logs -f

# إعادة تشغيل
docker-compose restart

# إيقاف
docker-compose down
```

---

**خلاص! استمتع! 🎊**
