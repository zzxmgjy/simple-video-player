import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { parseDSN } from '../server/db.js'

// 加载 .env 文件
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

async function initDB() {
  const SQL_DSN = process.env.SQL_DSN?.replace(/^'|'$/g, '') // 移除单引号
  
  if (!SQL_DSN) {
    console.error('❌ 未找到 SQL_DSN 环境变量')
    process.exit(1)
  }

  try {
    console.log('正在连接数据库...')
    
    // 使用通用的DSN解析函数
    const options = parseDSN(SQL_DSN)
    const connection = await mysql.createConnection(options)

    console.log('✅ 数据库连接成功')

    // 创建配置表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS configs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        config JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    console.log('✅ 配置表创建成功')
    
    await connection.end()
    console.log('✅ 数据库初始化完成')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    process.exit(1)
  }
}

initDB()
