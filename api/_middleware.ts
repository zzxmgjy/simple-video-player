import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeDatabase } from '../src/utils/db'

// 初始化数据库连接
async function setupDatabase() {
  try {
    // initializeDatabase会自动选择使用 SQL_DSN 或 PG_CONNECTION_STRING
    const db = await initializeDatabase()
    if (db) {
      console.log('数据库连接已初始化')
    } else {
      console.warn('未找到数据库连接配置，API可能无法正常工作')
    }
  } catch (error) {
    console.error('数据库连接初始化失败:', error)
  }
}

// 确保只初始化一次
let initialized = false

// API中间件
export default async function middleware(
  req: VercelRequest,
  res: VercelResponse,
  next: () => void
) {
  // 设置通用CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // 初始化数据库连接
  if (!initialized) {
    await setupDatabase()
    initialized = true
  }

  // 继续处理请求
  return next()
} 