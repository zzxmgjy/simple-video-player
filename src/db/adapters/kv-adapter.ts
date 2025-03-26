import { DatabaseAdapter } from './base.js';

/**
 * Cloudflare KV 数据库适配器
 * 实现基础数据库适配器接口，用于处理 Cloudflare KV 数据库操作
 */
export class KVAdapter implements DatabaseAdapter {
  private kvNamespace: any;
  private initialized = false;

  /**
   * 构造函数
   * @param kvNamespace Cloudflare KV Namespace 对象
   */
  constructor(kvNamespace: any) {
    this.kvNamespace = kvNamespace;
  }

  /**
   * 初始化数据库连接
   */
  public async initialize(): Promise<boolean> {
    if (!this.kvNamespace) return false;
    
    // 检查 KV 命名空间对象是否有效
    if (typeof this.kvNamespace !== 'object') {
      console.error('KV 命名空间必须是对象类型');
      return false;
    }
    
    this.initialized = true;
    return true;
  }

  /**
   * 获取一个值
   * @param key 键名
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.kvNamespace) return null;
    
    try {
      // 支持不同的 KV 接口
      let value = null;
      if (typeof this.kvNamespace.get === 'function') {
        value = await this.kvNamespace.get(key);
      } else if (typeof this.kvNamespace.read === 'function') {
        value = await this.kvNamespace.read(key);
      } else {
        console.error('KV 命名空间对象没有 get 或 read 方法');
        return null;
      }
      
      if (value === null) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      console.error(`获取 KV 键失败:`, error);
      return null;
    }
  }

  /**
   * 设置一个值
   * @param key 键名
   * @param value 值
   */
  public async set<T>(key: string, value: T): Promise<boolean> {
    if (!this.kvNamespace) return false;
    
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // 支持不同的 KV 接口
      if (typeof this.kvNamespace.put === 'function') {
        await this.kvNamespace.put(key, stringValue);
      } else if (typeof this.kvNamespace.write === 'function') {
        await this.kvNamespace.write(key, stringValue);
      } else if (typeof this.kvNamespace.set === 'function') {
        await this.kvNamespace.set(key, stringValue);
      } else {
        console.error('KV 命名空间对象没有 put、write 或 set 方法');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`设置 KV 键失败:`, error);
      return false;
    }
  }

  /**
   * 删除一个值
   * @param key 键名
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.kvNamespace) return false;
    
    try {
      // 支持不同的 KV 接口
      if (typeof this.kvNamespace.delete === 'function') {
        await this.kvNamespace.delete(key);
      } else if (typeof this.kvNamespace.remove === 'function') {
        await this.kvNamespace.remove(key);
      } else {
        console.error('KV 命名空间对象没有 delete 或 remove 方法');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`删除 KV 键失败:`, error);
      return false;
    }
  }

  /**
   * 列出所有键
   * 注意: Cloudflare KV 的 list 可能需要处理分页
   */
  public async list(): Promise<string[]> {
    if (!this.kvNamespace) return [];
    
    try {
      // 支持不同的 KV 接口
      if (typeof this.kvNamespace.list === 'function') {
        // 这里假设键的数量不会太多，实际使用中可能需要处理分页
        const keys = await this.kvNamespace.list();
        if (keys && keys.keys) {
          return keys.keys.map((k: any) => k.name);
        }
      } else if (typeof this.kvNamespace.keys === 'function') {
        const keys = await this.kvNamespace.keys();
        if (Array.isArray(keys)) {
          return keys;
        }
      }
      
      console.warn('KV 命名空间对象没有可用的 list 或 keys 方法');
      return [];
    } catch (error) {
      console.error('列出 KV 键失败:', error);
      return [];
    }
  }

  /**
   * 查询数据（KV 不支持 SQL 查询，返回空数组）
   */
  public async query<T>(): Promise<T[]> {
    console.warn('KV 存储不支持 SQL 查询操作');
    return [] as unknown as T[];
  }

  /**
   * 执行事务（KV 不支持事务，直接执行回调）
   * @param callback 事务回调函数
   */
  public async transaction<T>(callback: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    return await callback(this);
  }

  /**
   * 关闭数据库连接（KV 不需要关闭连接）
   */
  public async close(): Promise<void> {
    this.initialized = false;
  }
} 
