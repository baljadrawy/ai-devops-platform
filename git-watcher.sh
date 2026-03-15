#!/bin/bash

cd ~/unified-platform-complete

echo "👀 مراقبة التغييرات..."

inotifywait -m -r -e modify,create,delete \
  --exclude '(\.git|node_modules|data|logs|\.backup)' \
  ~/unified-platform-complete | while read path action file; do
    
    echo "📝 تم تعديل: $file"
    
    # انتظر 30 ثانية (لتجميع التعديلات)
    sleep 30
    
    # Push
    if [[ -n $(git status -s) ]]; then
        git add .
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
        git commit -m "🔄 Auto-update: $TIMESTAMP - Modified: $file"
        git push origin main
        echo "✅ تم الرفع!"
    fi
done
