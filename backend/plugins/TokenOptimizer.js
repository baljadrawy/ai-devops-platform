export class TokenOptimizer {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 50;
    this.compressionThreshold = 100000;
  }

  getCacheKey(message) {
    // استخدام hash كامل للرسالة
    const normalized = message.toLowerCase().trim();
    
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    // دمج hash مع أول 30 حرف
    return `${hash}_${normalized.substring(0, 30)}`;
  }

  checkCache(message) {
    const key = this.getCacheKey(message);
    
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      const age = Date.now() - cached.timestamp;
      
      // Cache expires after 5 minutes
      if (age < 300000) {
        console.log('💰 Cache hit - توفير 100%!');
        return {
          fromCache: true,
          response: cached.response,
          tokensSaved: cached.tokensSaved
        };
      } else {
        this.cache.delete(key);
      }
    }
    
    return { fromCache: false };
  }

  saveToCache(message, response, tokensSaved) {
    const key = this.getCacheKey(message);
    
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      response,
      tokensSaved,
      timestamp: Date.now()
    });
  }

  optimizeMessages(messages) {
    const recentMessages = messages.slice(-5);
    
    return recentMessages.map(msg => {
      if (msg.content && msg.content.length > 2000) {
        return {
          ...msg,
          content: msg.content.substring(0, 2000) + '...'
        };
      }
      return msg;
    });
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize
    };
  }
}
