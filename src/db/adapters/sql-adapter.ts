import { DatabaseAdapter } from './base.js';
import mysql from 'mysql2/promise';

/**
 * SQL 数据库适配器
 * 实现基础数据库适配器接口，用于处理 SQL 数据库操作
 */
export class SQLAdapter implements DatabaseAdapter {
  private pool: mysql.Pool | null = null;
  private dsn: string;
  private initialized = false;
  private readonly configTable = 'configs';

  /**
   * 构造函数
   * @param dsn 数据库连接字符串
   */
  constructor(dsn: string) {
    this.dsn = dsn;
  }

  /**
   * 解析数据库连接字符串(DSN)
   * 示例: username:password@hostname:port/database
   */
  private parseDSN(dsn: string): mysql.PoolOptions {
    // 解析 DSN 字符串
    const [auth, rest] = dsn.split('@');
    const [username, password] = auth.split(':');
    const [host, dbName] = rest.split('/');
    const [hostname, port] = host.split(':');
    
    return {
      host: hostname.replace('tcp(', '').replace(')', ''),
      port: parseInt(port),
      user: username,
      password: password,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      queueLimit: 0
    };
  }

  /**
   * 初始化数据库连接
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (!this.dsn) return false;
    
    try {
      this.pool = mysql.createPool(this.parseDSN(this.dsn));
      
      // 测试连接并创建基础表
      const connection = await this.pool.getConnection();
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS ${this.configTable} (
            id INT PRIMARY KEY AUTO_INCREMENT,
            config JSON NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        this.initialized = true;
        return true;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('初始化 SQL 连接池失败:', error);
      this.pool = null;
      return false;
    }
  }

  /**
   * 获取一个值
   * @param key 键名
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return null;
    
    try {
      const connection = await this.pool.getConnection();
      try {
        // 根据key获取配置
        let query = '';
        let params: any[] = [];
        
        if (key === 'config') {
          // 如果是获取主配置，获取ID为1的记录
          query = `SELECT config FROM ${this.configTable} WHERE id = 1 LIMIT 1`;
        } else {
          // 如果是自定义key，可以根据需要调整查询逻辑
          // 这里假设config字段中存储的是JSON，包含各种配置项
          query = `SELECT config FROM ${this.configTable} WHERE id = ? LIMIT 1`;
          params = [key];
        }
        
        const [rows] = await connection.query(query, params) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
        
        if (rows.length > 0) {
          return typeof rows[0].config === 'string' 
            ? JSON.parse(rows[0].config) 
            : rows[0].config;
        }
        return null;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error(`获取 ${key} 失败:`, error);
      return null;
    }
  }

  /**
   * 设置一个值
   * @param key 键名
   * @param value 值
   */
  public async set<T>(key: string, value: T): Promise<boolean> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return false;
    
    try {
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        
        let query = '';
        let params: any[] = [];
        
        if (key === 'config') {
          // 如果是保存主配置，使用ID为1
          const [rows] = await connection.query(
            `SELECT id FROM ${this.configTable} WHERE id = 1 LIMIT 1`
          ) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
          
          if (rows.length > 0) {
            query = `UPDATE ${this.configTable} SET config = ? WHERE id = 1`;
            params = [JSON.stringify(value)];
          } else {
            query = `INSERT INTO ${this.configTable} (id, config) VALUES (1, ?)`;
            params = [JSON.stringify(value)];
          }
        } else {
          // 如果是自定义key，可以根据需要调整存储逻辑
          const [rows] = await connection.query(
            `SELECT id FROM ${this.configTable} WHERE id = ? LIMIT 1`,
            [key]
          ) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
          
          if (rows.length > 0) {
            query = `UPDATE ${this.configTable} SET config = ? WHERE id = ?`;
            params = [JSON.stringify(value), key];
          } else {
            query = `INSERT INTO ${this.configTable} (id, config) VALUES (?, ?)`;
            params = [key, JSON.stringify(value)];
          }
        }
        
        await connection.query(query, params);
        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error(`设置 ${key} 失败:`, error);
      return false;
    }
  }

  /**
   * 删除一个值
   * @param key 键名
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return false;
    
    try {
      const connection = await this.pool.getConnection();
      try {
        let query = '';
        let params: any[] = [];
        
        if (key === 'config') {
          // 如果是删除主配置，使用ID为1
          query = `DELETE FROM ${this.configTable} WHERE id = 1`;
        } else {
          // 如果是自定义key
          query = `DELETE FROM ${this.configTable} WHERE id = ?`;
          params = [key];
        }
        
        await connection.execute(query, params);
        return true;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error(`删除 ${key} 失败:`, error);
      return false;
    }
  }

  /**
   * 列出所有键
   */
  public async list(): Promise<string[]> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return [];
    
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.query(
          `SELECT id FROM ${this.configTable}`
        ) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
        
        return rows.map(row => row.id.toString());
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('列出所有键失败:', error);
      return [];
    }
  }

  /**
   * 查询数据
   * @param query SQL查询语句
   * @param params 查询参数
   */
  public async query<T>(query: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return [];
    
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.query(query, params) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
        return rows as unknown as T[];
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('查询失败:', error);
      return [];
    }
  }

  /**
   * 执行事务
   * @param callback 事务回调函数
   */
  public async transaction<T>(callback: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    if (!this.pool) await this.initialize();
    if (!this.pool) throw new Error('数据库未初始化');
    
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // 创建一个临时的适配器实例，只用于事务中
      const transactionAdapter: DatabaseAdapter = {
        ...this,
        async query<U>(query: string, params: any[] = []): Promise<U[]> {
          const [rows] = await connection.query(query, params) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
          return rows as unknown as U[];
        },
        async transaction<U>(): Promise<U> {
          throw new Error('不支持嵌套事务');
        },
      };
      
      const result = await callback(transactionAdapter);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 关闭数据库连接
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
    }
  }
} 
