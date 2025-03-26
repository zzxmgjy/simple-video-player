import { handleConfigRequest, handleAuthRequest } from './src/api/server.js'

export default {
  async fetch(request, env, ctx) {
    // 设置 CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    try {
      // 区分不同类型的请求
      if (request.url.includes('/api/auth/verify')) {
        // 验证请求
        return await handleAuthRequest(request, env)
      } else if (request.url.includes('/api/admin/config') || request.url.includes('/api/home/config')) {
        // 配置请求
        return await handleConfigRequest(request, env)
      }

      // 处理静态文件
      return env.ASSETS.fetch(request)
    } catch (error) {
      console.error('请求处理失败:', error)
      return new Response(JSON.stringify({ 
        error: '服务器错误',
        details: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: corsHeaders
      })
    }
  }
}
