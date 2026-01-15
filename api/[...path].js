export const config = {
  runtime: 'edge',
  regions: ["sfo1", "pdx1", "iad1"],
};

export default async function handler(request) {
  const TARGET_DOMAIN = process.env.TARGET_DOMAIN;
  
  if (!TARGET_DOMAIN) {
    return new Response('Error: TARGET_DOMAIN is not set.', { status: 500 });
  }

  // 1. 处理 OPTIONS (CORS)
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
    // 2. 解析原始请求 URL
    const url = new URL(request.url);

    // 3. 【路径清洗】
    // Vercel 的 rewrite 会把 /v1/models 变成 /api/v1/models
    // 我们需要把 /api 前缀去掉，还原成 /v1/models
    let pathname = url.pathname;
    if (pathname.startsWith('/api')) {
      pathname = pathname.replace(/^\/api/, '');
    }
    // 如果是空路径，补全为 /
    if (!pathname) {
      pathname = '/';
    }

    // 4. 【参数清洗】(关键步骤)
    // Vercel 遇到 [...path].js 会自动注入一个名为 "path" 的参数
    // 我们必须把它删掉，否则就会出现你之前的 ?...path=management.html
    url.searchParams.delete('path'); 

    // 5. 构建目标 URL
    // 目标 = 域名 + 清洗后的路径 + 清洗后的参数
    const targetUrlString = TARGET_DOMAIN.replace(/\/$/, '') + pathname + url.search;
    const targetUrl = new URL(targetUrlString);

    // 6. 调试日志 (部署后在 Vercel Logs 查看)
    console.log(`[Proxy] ${request.method} ${request.url} -> ${targetUrl.toString()}`);

    // 7. 准备 Headers
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('origin', TARGET_DOMAIN);
    headers.set('referer', TARGET_DOMAIN + '/');

    // 8. 发起请求
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual', 
    });

    // 9. 处理响应 Headers
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
