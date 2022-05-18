import * as redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) =>
      console.error('Redis client not connected to the server:', err)
    );
    this._is_alive = false;
    this.client.on('ready', () => {
      this._is_alive = true;
    });
    this.client.promise = Object.entries(redis.RedisClient.prototype)
      .filter((kv) => typeof kv[1] === 'function')
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: promisify(value).bind(this.client),
        }),
        {}
      );
  }

  isAlive() {
    return this._is_alive;
  }

  async get(key) {
    try {
      return this.client.promise.get(key);
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  async set(key, value, duration) {
    try {
      return this.client.promise.set(key, value, 'EX', duration);
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  async del(key) {
    try {
      return this.client.promise.del(key);
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }
}

const redisClient = new RedisClient();

export default redisClient;
