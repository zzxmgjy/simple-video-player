import mysql from 'mysql2/promise'
import postgres from 'postgres'

// 数据库连接池单例
let mysqlPool: mysql.Pool | null = null
let pgClient: ReturnType<typeof postgres> | null = null

/**
 * 解析数据库连接字符串(DSN)
 * 示例: username:password@hostname:port/database
 */
export function parseDSN(dsn: string): mysql.PoolOptions {
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
 * 获取数据库连接信息
 * 优先使用 MySQL (SQL_DSN)，如果不存在则使用 PostgreSQL (PG_CONNECTION_STRING)
 */
function getDbConnectionInfo(): { type: 'mysql' | 'postgresql', connectionString: string } | null {
  const sqlDsn = process.env.SQL_DSN
  const pgConnectionString = process.env.PG_CONNECTION_STRING
  
  if (sqlDsn) {
    return {
      type: 'mysql',
      connectionString: sqlDsn
    }
  } else if (pgConnectionString) {
    return {
      type: 'postgresql',
      connectionString: pgConnectionString
    }
  }
  
  return null
}

/**
 * 初始化数据库连接池（单例模式）
 * 优先使用 MySQL，如果没有 SQL_DSN 则使用 PostgreSQL
 * @param forceConnectionString 可选的强制使用的连接字符串
 * @returns MySQL连接池实例或PostgreSQL客户端或null
 */
export async function initializeDatabase(forceConnectionString?: string): Promise<mysql.Pool | ReturnType<typeof postgres> | null> {
  let connInfo = getDbConnectionInfo()
  
  // 如果提供了强制连接字符串，则覆盖环境变量中的连接信息
  if (forceConnectionString) {
    connInfo = {
      type: forceConnectionString.includes('postgresql:') ? 'postgresql' : 'mysql',
      connectionString: forceConnectionString
    }
  }
  
  if (!connInfo) {
    console.log('未提供数据库连接信息，无法初始化连接')
    return null
  }
  
  try {
    if (connInfo.type === 'mysql') {
      // MySQL 连接
      if (!mysqlPool) {
        console.log('初始化 MySQL 连接池')
        mysqlPool = mysql.createPool(parseDSN(connInfo.connectionString))

        // 测试连接并创建基础表
        const connection = await mysqlPool.getConnection()
        try {
          console.log('测试 MySQL 数据库连接...')
          await connection.query(`
            CREATE TABLE IF NOT EXISTS configs (
              id INT PRIMARY KEY AUTO_INCREMENT,
              config JSON NOT NULL,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
          `)
          console.log('✅ MySQL 数据库连接成功，配置表已就绪')
        } finally {
          connection.release()
        }
      }
      return mysqlPool
    } else {
      // PostgreSQL 连接
      if (!pgClient) {
        console.log('初始化 PostgreSQL 连接池')
        // 使用 postgres 连接字符串
        pgClient = postgres(connInfo.connectionString, {
          // 确保自动解析 JSONB 类型
          types: {
            // 确保 JSON 类型会被正确解析
            jsonb: {
              to: 1184, // OID for JSONB 类型
              from: [3802], // OID for JSONB 类型
              serialize: (obj: any) => JSON.stringify(obj),
              parse: (str: string) => typeof str === 'string' ? JSON.parse(str) : str
            }
          }
        })
        
        // 测试连接并创建基础表
        try {
          console.log('测试 PostgreSQL 数据库连接...')
          await pgClient`
            CREATE TABLE IF NOT EXISTS configs (
              id SERIAL PRIMARY KEY,
              config JSONB NOT NULL,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `
          console.log('✅ PostgreSQL 数据库连接成功，配置表已就绪')
        } catch (error) {
          console.error('PostgreSQL 表创建失败:', error)
          throw error
        }
      }
      return pgClient
    }
  } catch (error) {
    console.error('初始化数据库连接失败:', error)
    // 重置连接池，以便下次重试
    if (connInfo.type === 'mysql') {
      mysqlPool = null
    } else {
      pgClient = null
    }
    return null
  }
}

/**
 * 获取当前已初始化的数据库连接
 * 返回 MySQL 连接池或 PostgreSQL 客户端
 */
export function getDatabase(): mysql.Pool | ReturnType<typeof postgres> | null {
  const connInfo = getDbConnectionInfo()
  if (!connInfo) return null
  
  return connInfo.type === 'mysql' ? mysqlPool : pgClient
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (mysqlPool) {
    await mysqlPool.end()
    mysqlPool = null
    console.log('MySQL 数据库连接池已关闭')
  }
  
  if (pgClient) {
    await pgClient.end({ timeout: 5 })
    pgClient = null
    console.log('PostgreSQL 数据库连接已关闭')
  }
}

/**
 * 执行数据库查询的辅助函数
 * @param callback 回调函数，接收数据库连接对象并返回Promise
 * @param connectionString 可选的连接字符串，覆盖环境变量
 * @returns 回调函数的结果
 */
export async function withDatabase<T>(
  callback: (
    db: mysql.PoolConnection | ReturnType<typeof postgres>, 
    dbType: 'mysql' | 'postgresql'
  ) => Promise<T>,
  connectionString?: string
): Promise<T> {
  const db = await initializeDatabase(connectionString)
  if (!db) {
    throw new Error('无法初始化数据库连接')
  }
  
  const connInfo = getDbConnectionInfo()
  const dbType = (connInfo?.type || (connectionString?.includes('postgresql:') ? 'postgresql' : 'mysql'))
  
  if (dbType === 'mysql') {
    // MySQL 连接
    const mysqlDb = db as mysql.Pool
    const connection = await mysqlDb.getConnection()
    try {
      return await callback(connection, 'mysql')
    } finally {
      connection.release()
    }
  } else {
    // PostgreSQL 连接
    const pgDb = db as ReturnType<typeof postgres>
    try {
      return await callback(pgDb, 'postgresql')
    } catch (error) {
      console.error('PostgreSQL 查询执行失败:', error)
      throw error
    }
  }
} 