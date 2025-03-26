import { handleConfigRequest, handleAuthRequest } from '../src/api/server.js'
import { onRequestPost as handleSearchRequest, onRequestOptions as handleSearchOptions } from './api/search.js'

export const onRequest = async ({ request, env, next }) => {
  // 设置 CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json'
  }

  // 处理 OPTIONS 请求
  if (request.method === 'OPTIONS') {
    // 如果是搜索API的OPTIONS请求，使用搜索专用处理函数
    if (request.url.includes('/api/search')) {
      return handleSearchOptions()
    }
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    // 处理 API 请求
    if (request.url.includes('/api/auth/verify')) {
      return await handleAuthRequest(request, env)
    } else if (request.url.includes('/api/admin/config') || request.url.includes('/api/home/config')) {
      return await handleConfigRequest(request, env)
    } else if (request.url.includes('/api/search')) {
      // 处理搜索API请求
      if (request.method === 'POST') {
        return await handleSearchRequest({ request, env })
      } else {
        // 明确返回405错误，表明该路径只接受POST方法
        return new Response('Method Not Allowed', { 
          status: 405,
          headers: { 
            ...corsHeaders,
            'Allow': 'POST, OPTIONS' 
          } 
        })
      }
    }

    // 继续处理静态文件
    return next()
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
