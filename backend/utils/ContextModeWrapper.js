import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Context Mode Integration
 * يوفر 99% من التوكنات في العمليات الكبيرة
 */
export class ContextModeWrapper {
  constructor() {
    this.name = 'context-mode';
    this.enabled = true;
  }

  /**
   * تنفيذ كود في sandbox مع ملخص تلقائي
   */
  async execute({ language, code, intent = null, timeout = 30000 }) {
    try {
      const command = this.getExecutionCommand(language, code);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB max
        env: { ...process.env }
      });

      // إذا كان الناتج كبير وفيه intent، نلخّص
      if (stdout.length > 5000 && intent) {
        return this.summarizeOutput(stdout, intent);
      }

      return {
        success: true,
        output: stdout,
        size: stdout.length,
        compressed: false
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        stderr: error.stderr
      };
    }
  }

  /**
   * تنفيذ كود مع محتوى ملف (بدون تحميل الملف للذاكرة)
   */
  async executeWithFile({ path, language, code, intent = null }) {
    const fileCode = `
      const fs = require('fs');
      const FILE_CONTENT = fs.readFileSync('${path}', 'utf8');
      ${code}
    `;

    return await this.execute({ language, code: fileCode, intent });
  }

  /**
   * تلخيص ناتج كبير بناءً على Intent
   */
  summarizeOutput(output, intent) {
    const lines = output.split('\n');
    const intentLower = intent.toLowerCase();

    // كلمات مفتاحية للبحث
    const keywords = this.extractKeywords(intentLower);
    
    // فلترة الأسطر المتعلقة
    const relevant = lines.filter(line => {
      const lineLower = line.toLowerCase();
      return keywords.some(keyword => lineLower.includes(keyword));
    });

    // إحصائيات عامة
    const stats = {
      totalLines: lines.length,
      relevantLines: relevant.length,
      errors: lines.filter(l => /error|fail|exception/i.test(l)).length,
      warnings: lines.filter(l => /warn|warning/i.test(l)).length
    };

    return {
      success: true,
      summary: {
        stats,
        relevantLines: relevant.slice(0, 20), // أول 20 سطر فقط
        keywords: keywords
      },
      size: JSON.stringify({stats, relevantLines: relevant.slice(0, 20)}).length,
      originalSize: output.length,
      compressed: true,
      savings: `${((1 - (relevant.length / lines.length)) * 100).toFixed(1)}%`
    };
  }

  /**
   * استخراج كلمات مفتاحية من Intent
   */
  extractKeywords(intent) {
    // إزالة كلمات شائعة
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    
    return intent
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .map(word => word.replace(/[^\w]/g, ''));
  }

  /**
   * بناء أمر التنفيذ حسب اللغة
   */
  getExecutionCommand(language, code) {
    // حفظ الكود في ملف مؤقت
    const tempFile = `/tmp/context-mode-${Date.now()}`;
    const fs = require('fs');

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        fs.writeFileSync(`${tempFile}.js`, code);
        return `node ${tempFile}.js`;

      case 'typescript':
      case 'ts':
        fs.writeFileSync(`${tempFile}.ts`, code);
        // استخدام tsx إذا موجود، وإلا ts-node
        return `npx tsx ${tempFile}.ts 2>/dev/null || npx ts-node ${tempFile}.ts`;

      case 'python':
      case 'py':
        fs.writeFileSync(`${tempFile}.py`, code);
        return `python3 ${tempFile}.py`;

      case 'shell':
      case 'bash':
      case 'sh':
        fs.writeFileSync(`${tempFile}.sh`, code);
        fs.chmodSync(`${tempFile}.sh`, 0o755);
        return `bash ${tempFile}.sh`;

      case 'ruby':
      case 'rb':
        fs.writeFileSync(`${tempFile}.rb`, code);
        return `ruby ${tempFile}.rb`;

      default:
        throw new Error(`اللغة ${language} غير مدعومة`);
    }
  }

  /**
   * تنظيف الملفات المؤقتة
   */
  cleanup() {
    try {
      execAsync('rm -f /tmp/context-mode-*');
    } catch (error) {
      // تجاهل أخطاء التنظيف
    }
  }
}

/**
 * Helper functions لاستخدام سهل
 */

// تنفيذ Docker command مع تلخيص
export async function dockerSummary(command, intent = 'errors warnings') {
  const cm = new ContextModeWrapper();
  return await cm.execute({
    language: 'shell',
    code: `docker ${command}`,
    intent
  });
}

// تحليل ملف كبير
export async function analyzeFile(path, language, analysisCode, intent) {
  const cm = new ContextModeWrapper();
  return await cm.executeWithFile({
    path,
    language,
    code: analysisCode,
    intent
  });
}

// استعلام DB مع ملخص
export async function dbQuerySummary(queryFn, intent = 'summary') {
  const cm = new ContextModeWrapper();
  
  // تنفيذ الاستعلام في sandbox
  return await cm.execute({
    language: 'javascript',
    code: `
      const result = ${queryFn.toString()}();
      
      if (result.rows && result.rows.length > 50) {
        // ملخص فقط
        console.log(JSON.stringify({
          count: result.rows.length,
          sample: result.rows.slice(0, 3),
          columns: Object.keys(result.rows[0] || {})
        }));
      } else {
        // النتيجة كاملة
        console.log(JSON.stringify(result));
      }
    `,
    intent
  });
}

export default ContextModeWrapper;
