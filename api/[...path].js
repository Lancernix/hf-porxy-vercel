export const config = {
  runtime: 'edge', 
  regions: ["sfo1", "pdx1", "iad1"],
};

export default async function handler(request) {
  const TARGET_DOMAIN = process.env.TARGET_DOMAIN;

  if (!TARGET_DOMAIN) {
    return new Response('Error: TARGET_DOMAIN is not set.', { status: 500 });
  }

  // 1. 处理 OPTIONS 预检请求 (解决跨域问题)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
  }

  try {
    const url = new URL(request.url);
    
    // 移除 /api 前缀
    // vercel.json 将所有请求 /(.*) 重写到了 /api/$1
    // 把 /api 去掉，还原出原始路径 /v1/chat...
    const originalPath = url.pathname.replace(/^\/api/, '');
    
    const targetUrl = new URL(originalPath + url.search, TARGET_DOMAIN);

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('origin', TARGET_DOMAIN);
    headers.set('referer', TARGET_DOMAIN + '/');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    
    // 3. 注入 CORS 头 (允许任何网站调用此接口)
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
