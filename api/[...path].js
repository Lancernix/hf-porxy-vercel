export const config = {
  runtime: 'edge', 
  regions: ["sfo1", "pdx1", "iad1"],
};

export default async function handler(request) {
  const TARGET_DOMAIN = process.env.TARGET_DOMAIN;

  if (!TARGET_DOMAIN) {
    return new Response('Error: TARGET_DOMAIN is not set.', { status: 500 });
  }

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
    
    // 1. 路径清理
    let path = url.pathname;
    if (path.startsWith('/api')) {
        path = path.replace(/^\/api/, '');
    }
    if (path === '') {
        path = '/';
    }

    // 2. 【核心修复】清理 Vercel 注入的 'path' 参数
    // 这里的 'path' 必须和你文件名 [...path].js 里的名字一致
    url.searchParams.delete('path'); 
    
    // 3. 重新构建干净的查询字符串
    // 如果用户真的传了 ?q=hello，这里会保留；如果没传，这里就是空的
    const cleanSearch = url.searchParams.toString();
    const searchPart = cleanSearch ? `?${cleanSearch}` : '';

    // 4. 拼接最终目标 URL
    const targetUrlString = TARGET_DOMAIN.replace(/\/$/, '') + path + searchPart;
    const targetUrl = new URL(targetUrlString);

    console.log(`[Proxy] ${request.method} ${url.pathname} -> ${targetUrl.toString()}`);

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
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[Proxy Error]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
