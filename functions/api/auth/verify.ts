import { verifyPassword } from '../../../src/api/server.js';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

export const onRequest = async ({ request, env }) => {
  // 设置 CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json'
  }

  // 处理 OPTIONS 请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  // 仅接受 POST 请求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '请求方法不允许' }), { 
      status: 405,
      headers: corsHeaders 
    })
  }

  try {
    const { password, isAdmin } = await request.json()
    
    let isValid = false
    if (isAdmin) {
      // 管理员验证
      isValid = password === env.ADMIN_PASSWORD
    } else {
      // 普通用户验证
      isValid = await verifyPassword(password, env)
    }
    
    if (isValid) {
      // 生成JWT令牌
      const token = generateToken(isAdmin, request)
      
      return new Response(JSON.stringify({ 
        success: true,
        token 
      }), {
        status: 200,
        headers: corsHeaders
      })
    } else {
      return new Response(JSON.stringify({ error: '密码错误' }), {
        status: 401,
        headers: corsHeaders
      })
    }
  } catch (error) {
    console.error('验证失败:', error)
    return new Response(JSON.stringify({ 
      error: '验证失败',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

// 生成JWT令牌
function generateToken(isAdmin, request) {
  const deviceFingerprint = generateDeviceFingerprint(request)
  return jwt.sign(
    { 
      isAdmin,
      deviceFingerprint,
      iat: Date.now(),
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')
    },
    process.env.LOGIN_JWT_SECRET_KEY || 'fallback_secret_key',
    { expiresIn: '24h' }
  )
}

// 生成设备指纹
function generateDeviceFingerprint(request) {
  const ua = request.headers.get('user-agent') || ''
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || ''
  return createHash('sha256').update(`${ua}|${ip}`).digest('hex')
}
