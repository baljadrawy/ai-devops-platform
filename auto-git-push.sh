#!/bin/bash

cd ~/unified-platform-complete

# تحقق من التغييرات
if [[ -n $(git status -s) ]]; then
    echo "📝 وجدت تغييرات جديدة..."
    
    # إضافة كل التغييرات
    git add .
    
    # Commit مع التاريخ والوقت
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    git commit -m "🔄 Auto-update: $TIMESTAMP"
    
    # Push
    git push origin main
    
    echo "✅ تم الرفع بنجاح!"
else
    echo "✨ لا توجد تغييرات"
fi
