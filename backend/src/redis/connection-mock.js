const logger = require('../utils/logger');

// Mock Redis client for development when Redis is not available
class MockRedisClient {
  constructor() {
    this.data = new Map();
    this.connected = true;
  }

  async connect() {
    logger.info('✅ Mock Redis connected successfully (development mode)');
    return this;
  }

  async quit() {
    logger.info('Mock Redis connection closed');
    return 'OK';
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async set(key, value, options = {}) {
    this.data.set(key, value);
    if (options.EX) {
      // Simulate expiration
      setTimeout(() => {
        this.data.delete(key);
      }, options.EX * 1000);
    }
    return 'OK';
  }

  async del(key) {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key, seconds) {
    if (this.data.has(key)) {
      setTimeout(() => {
        this.data.delete(key);
      }, seconds * 1000);
      return 1;
    }
    return 0;
  }

  async keys(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }

  async flushAll() {
    this.data.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  on(event, callback) {
    // Mock event handling
    if (event === 'connect') {
      setTimeout(() => callback(), 100);
    } else if (event === 'ready') {
      setTimeout(() => callback(), 200);
    }
    return this;
  }

  // Add other Redis methods as needed
  async hget(key, field) {
    const hash = this.data.get(key);
    return hash && typeof hash === 'object' ? hash[field] : null;
  }

  async hset(key, field, value) {
    let hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') {
      hash = {};
    }
    hash[field] = value;
    this.data.set(key, hash);
    return 1;
  }

  async hgetall(key) {
    const hash = this.data.get(key);
    return hash && typeof hash === 'object' ? hash : {};
  }

  async sadd(key, ...members) {
    let set = this.data.get(key);
    if (!set || !Array.isArray(set)) {
      set = [];
    }
    let added = 0;
    members.forEach(member => {
      if (!set.includes(member)) {
        set.push(member);
        added++;
      }
    });
    this.data.set(key, set);
    return added;
  }

  async smembers(key) {
    const set = this.data.get(key);
    return Array.isArray(set) ? set : [];
  }

  async srem(key, ...members) {
    let set = this.data.get(key);
    if (!Array.isArray(set)) {
      return 0;
    }
    let removed = 0;
    members.forEach(member => {
      const index = set.indexOf(member);
      if (index > -1) {
        set.splice(index, 1);
        removed++;
      }
    });
    this.data.set(key, set);
    return removed;
  }
}

let redisClient;

const connectRedis = async () => {
  try {
    logger.info('🔧 Using Mock Redis for development (Redis not available)');
    
    redisClient = new MockRedisClient();
    await redisClient.connect();

    // Set global Redis client
    global.redis = redisClient;

    logger.info('✅ Mock Redis ready for operations');
    return redisClient;
  } catch (error) {
    logger.error('❌ Mock Redis setup failed:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redisClient;
};

const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Mock Redis connection closed');
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis
};
