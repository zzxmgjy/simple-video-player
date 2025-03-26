/**
 * 基础数据库适配器接口
 * 所有具体的数据库适配器都需要实现这个接口
 */
export interface DatabaseAdapter {
  /**
   * 初始化数据库连接
   */
  initialize(): Promise<boolean>;

  /**
   * 获取一个值
   * @param key 键名
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * 设置一个值
   * @param key 键名
   * @param value 值
   */
  set<T>(key: string, value: T): Promise<boolean>;

  /**
   * 删除一个值
   * @param key 键名
   */
  delete(key: string): Promise<boolean>;

  /**
   * 列出所有键
   */
  list(): Promise<string[]>;

  /**
   * 查询数据（只在 SQL 数据库中支持）
   * @param query SQL查询语句
   * @param params 查询参数
   */
  query<T>(query: string, params?: any[]): Promise<T[]>;

  /**
   * 执行事务（只在 SQL 数据库中支持）
   * @param callback 事务回调函数
   */
  transaction<T>(callback: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;

  /**
   * 关闭数据库连接
   */
  close(): Promise<void>;
} 
