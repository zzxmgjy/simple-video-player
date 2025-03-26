import type { VercelRequest, VercelResponse } from '@vercel/node'
import mysql from 'mysql2/promise'
import jwt from 'jsonwebtoken'
import { withDatabase } from '../../src/utils/db.js'
import postgres from 'postgres'

// 生成设备指纹
function generateDeviceFingerprint(req: VercelRequest): string {
  const userAgent = req.headers['user-agent'] || ''
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
  return `${userAgent}|${ip}`
}

// 生成JWT令牌
function generateToken(isAdmin: boolean, req: VercelRequest): string {
  const deviceFingerprint = generateDeviceFingerprint(req)
  return jwt.sign(
    { 
      isAdmin,
      deviceFingerprint,
      iat: Date.now(),
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    },
    process.env.LOGIN_JWT_SECRET_KEY || 'fallback_secret_key',
    { expiresIn: '24h' }
  )
}

// 验证密码
async function verifyPassword(password: string): Promise<boolean> {
  try {
    return await withDatabase(async (connection, dbType) => {
      if (dbType === 'mysql') {
        // MySQL 查询
        const mysqlConn = connection as mysql.PoolConnection
        const [rows] = await mysqlConn.query('SELECT config FROM configs ORDER BY id DESC LIMIT 1') as [mysql.RowDataPacket[], mysql.FieldPacket[]]
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0]
          const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config
          return password === config.loginPassword
        }
      } else {
        // PostgreSQL 查询
        const pgConn = connection as ReturnType<typeof postgres>
        const result = await pgConn`SELECT config FROM configs ORDER BY id DESC LIMIT 1`
        if (result.length > 0) {
          // 确保正确解析PostgreSQL返回的配置数据
          const pgConfig = result[0].config
          const config = typeof pgConfig === 'string' ? JSON.parse(pgConfig) : pgConfig
          return password === config.loginPassword
        }
      }
      return true
    })
  } catch (error) {
    console.error('验证密码失败:', error)
    return false
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { password, isAdmin } = req.body
    console.log('收到登录请求:', { isAdmin })

    if (!password) {
      return res.status(400).json({ error: '密码不能为空' })
    }

    // 验证密码
    let isValid = false
    if (isAdmin) {
      // 管理员验证
      isValid = password === process.env.ADMIN_PASSWORD
    } else {
      // 普通用户验证 - 通过自动选择的数据库连接方式验证
      isValid = await verifyPassword(password)
    }

    if (isValid) {
      // 生成JWT令牌
      const token = generateToken(isAdmin, req)
      console.log('登录成功,生成token')
      
      return res.status(200).json({ 
        success: true,
        token
      })
    } else {
      console.log('密码验证失败:', { isAdmin })
      return res.status(401).json({ error: '密码错误' })
    }
  } catch (error) {
    console.error('验证失败:', error)
    return res.status(500).json({ error: '验证失败' })
  }
} 