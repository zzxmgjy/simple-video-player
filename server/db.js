import mysql from 'mysql2/promise'

// MySQL 连接池单例
let pool = null

/**
 * 解析数据库连接字符串(DSN)
 * 示例: username:password@hostname:port/database
 */
export function parseDSN(dsn) {
  // 解析 DSN 字符串
  const [auth, rest] = dsn.split('@')
  const [username, password] = auth.split(':')
  const [host, dbName] = rest.split('/')
  const [hostname, port] = host.split(':')
  
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
  }
}

/**
 * 初始化数据库连接池（单例模式）
 * @param {string} dsn 数据库连接字符串
 * @returns {Promise<mysql.Pool|null>} MySQL连接池实例或null
 */
export async function initializePool(dsn) {
  if (!dsn) {
    console.log('未提供 DSN，无法初始化连接池')
    return null
  }
  
  try {
    if (!pool) {
      console.log('初始化 MySQL 连接池')
      pool = mysql.createPool(parseDSN(dsn))

      // 测试连接并创建基础表
      const connection = await pool.getConnection()
      try {
        console.log('测试数据库连接...')
        await connection.query(`
          CREATE TABLE IF NOT EXISTS configs (
            id INT PRIMARY KEY AUTO_INCREMENT,
            config JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `)
        console.log('✅ 数据库连接成功，配置表已就绪')
      } finally {
        connection.release()
      }
    }
    return pool
  } catch (error) {
    console.error('初始化连接池失败:', error)
    pool = null // 重置连接池，以便下次重试
    return null
  }
}

/**
 * 获取数据库连接池的当前实例
 * 如果连接池尚未初始化，将返回null
 * @returns {mysql.Pool|null}
 */
export function getPool() {
  return pool
}

/**
 * 关闭数据库连接池
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
    console.log('数据库连接池已关闭')
  }
}

/**
 * 执行数据库查询的辅助函数
 * @param {string} dsn 数据库连接字符串
 * @param {function} callback 回调函数，接收连接对象并返回Promise
 * @returns {Promise<any>} 回调函数的结果
 */
export async function withConnection(dsn, callback) {
  const pool = await initializePool(dsn)
  if (!pool) {
    throw new Error('无法初始化数据库连接池')
  }
  
  const connection = await pool.getConnection()
  try {
    return await callback(connection)
  } finally {
    connection.release()
  }
} 
