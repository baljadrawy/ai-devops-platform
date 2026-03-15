import * as esprima from 'esprima';
import { ESLint } from 'eslint';
import { readFileSync, writeFileSync } from 'fs';

/**
 * Plugin لتحليل ومعالجة الأكواد
 */
export class CodeAnalysisPlugin {
  constructor() {
    this.name = 'code';
    this.description = 'تحليل ومعالجة الأكواد البرمجية';
    this.eslint = new ESLint();
  }

  getCommands() {
    return {
      'code.analyze': this.analyzeCode.bind(this),
      'code.lint': this.lintCode.bind(this),
      'code.parse': this.parseCode.bind(this),
      'code.complexity': this.calculateComplexity.bind(this),
      'code.findBugs': this.findBugs.bind(this),
      'code.refactor': this.suggestRefactoring.bind(this),
      'code.generateTests': this.generateTests.bind(this),
      'code.document': this.generateDocumentation.bind(this),
    };
  }

  /**
   * تحليل شامل للكود
   */
  async analyzeCode(params) {
    const { code, language = 'javascript' } = params;

    try {
      const analysis = {
        language,
        linesOfCode: code.split('\n').length,
        complexity: await this.calculateComplexity({ code }),
        lintResults: await this.lintCode({ code }),
        ast: this.parseCode({ code }),
        recommendations: []
      };

      // توصيات بسيطة
      if (analysis.complexity.data.average > 10) {
        analysis.recommendations.push('التعقيد عالي - يُنصح بتقسيم الدوال');
      }

      if (analysis.lintResults.data.errors > 0) {
        analysis.recommendations.push('يوجد أخطاء - يجب إصلاحها');
      }

      return {
        success: true,
        data: analysis
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * فحص الأخطاء
   */
  async lintCode(params) {
    const { code, filePath = 'temp.js' } = params;

    try {
      const results = await this.eslint.lintText(code, {
        filePath
      });

      const summary = {
        errors: 0,
        warnings: 0,
        issues: []
      };

      results.forEach(result => {
        summary.errors += result.errorCount;
        summary.warnings += result.warningCount;
        
        result.messages.forEach(msg => {
          summary.issues.push({
            line: msg.line,
            column: msg.column,
            severity: msg.severity === 2 ? 'error' : 'warning',
            message: msg.message,
            ruleId: msg.ruleId
          });
        });
      });

      return {
        success: true,
        data: summary
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * تحليل بنية الكود (AST)
   */
  parseCode(params) {
    const { code } = params;

    try {
      const ast = esprima.parseModule(code, { 
        tolerant: true,
        range: true,
        loc: true 
      });

      // استخراج معلومات مفيدة
      const info = {
        functions: [],
        classes: [],
        imports: [],
        exports: []
      };

      ast.body.forEach(node => {
        if (node.type === 'FunctionDeclaration') {
          info.functions.push({
            name: node.id.name,
            params: node.params.map(p => p.name),
            loc: node.loc
          });
        }
        else if (node.type === 'ClassDeclaration') {
          info.classes.push({
            name: node.id.name,
            loc: node.loc
          });
        }
        else if (node.type === 'ImportDeclaration') {
          info.imports.push({
            source: node.source.value,
            specifiers: node.specifiers.map(s => s.local.name)
          });
        }
        else if (node.type === 'ExportNamedDeclaration') {
          info.exports.push({
            type: 'named',
            loc: node.loc
          });
        }
      });

      return {
        success: true,
        data: { ast: info, raw: ast }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * حساب التعقيد الدوري (Cyclomatic Complexity)
   */
  async calculateComplexity(params) {
    const { code } = params;

    try {
      const ast = esprima.parseModule(code);
      let totalComplexity = 0;
      let functionCount = 0;

      const calculateNodeComplexity = (node) => {
        let complexity = 1; // كل دالة تبدأ بـ 1

        const traverse = (n) => {
          if (!n) return;

          // نقاط القرار
          if (['IfStatement', 'WhileStatement', 'ForStatement', 
               'ForInStatement', 'ForOfStatement', 'DoWhileStatement',
               'SwitchCase', 'ConditionalExpression'].includes(n.type)) {
            complexity++;
          }

          // تفريعات منطقية
          if (n.type === 'LogicalExpression' && n.operator === '||') {
            complexity++;
          }

          // معالجة الأخطاء
          if (n.type === 'CatchClause') {
            complexity++;
          }

          // التكرار على العناصر الفرعية
          for (const key in n) {
            if (n[key] && typeof n[key] === 'object') {
              if (Array.isArray(n[key])) {
                n[key].forEach(child => traverse(child));
              } else {
                traverse(n[key]);
              }
            }
          }
        };

        traverse(node);
        return complexity;
      };

      ast.body.forEach(node => {
        if (node.type === 'FunctionDeclaration' || 
            node.type === 'FunctionExpression') {
          const complexity = calculateNodeComplexity(node);
          totalComplexity += complexity;
          functionCount++;
        }
      });

      return {
        success: true,
        data: {
          total: totalComplexity,
          functions: functionCount,
          average: functionCount > 0 ? totalComplexity / functionCount : 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * اكتشاف الأخطاء الشائعة
   */
  async findBugs(params) {
    const { code } = params;

    try {
      const bugs = [];

      // فحص بسيط لأنماط خطأ شائعة
      const patterns = [
        {
          regex: /==(?!=)/g,
          message: 'استخدم === بدلاً من ==',
          severity: 'warning'
        },
        {
          regex: /var\s+/g,
          message: 'استخدم let أو const بدلاً من var',
          severity: 'warning'
        },
        {
          regex: /console\.log/g,
          message: 'تم العثور على console.log - احذفها قبل الإنتاج',
          severity: 'info'
        }
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.regex.exec(code)) !== null) {
          bugs.push({
            position: match.index,
            message: pattern.message,
            severity: pattern.severity
          });
        }
      });

      return {
        success: true,
        data: { bugs, count: bugs.length }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * اقتراحات التحسين
   */
  async suggestRefactoring(params) {
    const { code } = params;

    try {
      const suggestions = [];

      // تحليل بسيط
      const lines = code.split('\n');
      
      // دوال طويلة
      let functionStart = -1;
      lines.forEach((line, i) => {
        if (line.includes('function ') || line.includes('const ') && line.includes('=>')) {
          functionStart = i;
        }
        if (functionStart >= 0 && line.includes('}')) {
          const length = i - functionStart;
          if (length > 50) {
            suggestions.push({
              type: 'long-function',
              line: functionStart,
              message: `الدالة طويلة جداً (${length} سطر) - يُنصح بتقسيمها`
            });
          }
          functionStart = -1;
        }
      });

      // كود مكرر
      const duplicates = this.findDuplicateCode(lines);
      suggestions.push(...duplicates);

      return {
        success: true,
        data: { suggestions, count: suggestions.length }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  findDuplicateCode(lines) {
    // بحث بسيط عن تكرار
    const duplicates = [];
    const seen = new Map();

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.length > 20) { // سطور طويلة فقط
        if (seen.has(trimmed)) {
          duplicates.push({
            type: 'duplicate',
            line: i,
            original: seen.get(trimmed),
            message: 'كود مكرر - يُنصح بإنشاء دالة'
          });
        } else {
          seen.set(trimmed, i);
        }
      }
    });

    return duplicates;
  }

  /**
   * توليد اختبارات
   */
  async generateTests(params) {
    const { code, framework = 'jest' } = params;

    try {
      const parseResult = this.parseCode({ code });
      if (!parseResult.success) {
        return parseResult;
      }

      const { functions } = parseResult.data.ast;
      let testCode = '';

      if (framework === 'jest') {
        testCode = `describe('Generated Tests', () => {\n`;
        
        functions.forEach(func => {
          testCode += `  test('${func.name} should work correctly', () => {\n`;
          testCode += `    // TODO: إضافة الاختبارات\n`;
          testCode += `    expect(${func.name}(${func.params.map(() => 'null').join(', ')})).toBeDefined();\n`;
          testCode += `  });\n\n`;
        });

        testCode += `});\n`;
      }

      return {
        success: true,
        data: { testCode, functions: functions.length }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * توليد توثيق
   */
  async generateDocumentation(params) {
    const { code } = params;

    try {
      const parseResult = this.parseCode({ code });
      if (!parseResult.success) {
        return parseResult;
      }

      const { functions, classes } = parseResult.data.ast;
      let docs = '# توثيق الكود\n\n';

      if (functions.length > 0) {
        docs += '## الدوال\n\n';
        functions.forEach(func => {
          docs += `### ${func.name}\n\n`;
          docs += `**المعاملات:** ${func.params.join(', ') || 'لا يوجد'}\n\n`;
          docs += `**الموقع:** السطر ${func.loc.start.line}\n\n`;
        });
      }

      if (classes.length > 0) {
        docs += '## الكلاسات\n\n';
        classes.forEach(cls => {
          docs += `### ${cls.name}\n\n`;
          docs += `**الموقع:** السطر ${cls.loc.start.line}\n\n`;
        });
      }

      return {
        success: true,
        data: { documentation: docs }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
