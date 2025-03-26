/**
 * 处理搜索请求
 */
export const onRequestPost = async (context) => {
  try {
    const body = await context.request.json()
    const { url, isPost, postData } = body

    if (!url) {
      return new Response('缺少必要的URL参数', { 
        status: 400,
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    // 构建请求
    const request = new Request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        ...(isPost ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
      },
      ...(isPost ? {
        method: 'POST',
        body: new URLSearchParams(postData).toString()
      } : {})
    })

    // 发送请求
    const response = await fetch(request)
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    // 获取响应内容类型
    const contentType = response.headers.get('content-type') || ''

    // 获取响应的编码
    let charset = 'utf-8'
    const charsetMatch = contentType.match(/charset=([^;]+)/i)
    if (charsetMatch) {
      charset = charsetMatch[1]
    }

    // 获取响应内容
    const buffer = await response.arrayBuffer()
    
    // 尝试使用多种编码解码
    const encodings = [charset, 'gbk', 'gb2312', 'utf-8', 'big5']
    let html = ''
    let success = false

    for (const encoding of encodings) {
      try {
        const decoder = new TextDecoder(encoding)
        const decoded = decoder.decode(buffer)

        if (decoded && decoded.length > 0) {
          html = decoded
          success = true
          break
        }
      } catch (e) {
        console.warn(`使用 ${encoding} 解码失败:`, e)
      }
    }

    if (!success) {
      console.warn('所有编码尝试失败，使用 UTF-8')
      const decoder = new TextDecoder('utf-8')
      html = decoder.decode(buffer)
    }

    if (!html.trim()) {
      throw new Error('返回的内容为空')
    }

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('搜索错误:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return new Response(errorMessage, { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
}

/**
 * 处理OPTIONS预检请求
 */
export const onRequestOptions = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

/**
 * 处理GET请求
 */
export const onRequest = async ({ request }) => {
  // 对于非POST、非OPTIONS请求，返回405方法不允许
  if (request.method === 'POST') {
    return onRequestPost({ request });
  } else if (request.method === 'OPTIONS') {
    return onRequestOptions();
  } else {
    return new Response('Method Not Allowed', { 
      status: 405,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Allow': 'POST, OPTIONS'
      }
    })
  }
} 
