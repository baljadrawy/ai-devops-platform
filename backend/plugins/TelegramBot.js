import TelegramBot from 'node-telegram-bot-api';

export class TelegramBotPlugin {
  constructor(token) {
    if (!token) {
      console.log('⚠️  Telegram Bot disabled - no token provided');
      this.enabled = false;
      return;
    }
    
    this.bot = new TelegramBot(token, { polling: true });
    this.chatIds = new Set();
    this.enabled = true;
    
    this.setupCommands();
    console.log('✅ Telegram Bot initialized');
  }
  
  setupCommands() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.chatIds.add(chatId);
      this.bot.sendMessage(chatId, 
        '🚀 مرحباً بك في منصة AI DevOps!\n\n' +
        'الأوامر المتاحة:\n' +
        '/status - حالة النظام\n' +
        '/help - المساعدة'
      );
    });
    
    this.bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId, '✅ النظام يعمل بشكل ممتاز!');
    });
    
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId, 
        '📚 الأوامر:\n' +
        '/start - بدء\n' +
        '/status - الحالة\n' +
        '/help - مساعدة'
      );
    });
  }
  
  sendAlert(type, title, message) {
    if (!this.enabled) return;
    
    const icons = {
      success: '✅',
      warning: '⚠️',
      danger: '❌'
    };
    
    const text = `${icons[type]} *${title}*\n\n${message}`;
    
    this.chatIds.forEach(chatId => {
      this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
        .catch(err => console.error('Telegram error:', err));
    });
  }
}
