export const config = {
  runtime: 'edge', 
  regions: ["sfo1", "pdx1", "iad1"],
};

export default async function handler(request) {
  const TARGET_DOMAIN = process.env.TARGET_DOMAIN;

  if (!TARGET_DOMAIN) {
    return new Response('Error: TARGET_DOMAIN is not set.', { status: 500 });
  }

  // 处理 OPTIONS 跨域预检
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
    
    // 【核心修正】逻辑说明：
    // Vercel 路由是 /api/[...path]
    // 假设用户访问 https://your.com/management.html
    // Vercel 内部重写为 https://your.com/api/management.html
    // 我们需要去掉 /api，保留 /management.html
    
    let path = url.pathname;
    if (path.startsWith('/api')) {
        path = path.replace(/^\/api/, '');
    }

    // 处理根路径情况 (如果访问 /api，变成了空字符串，需要补为 /)
    if (path === '') {
        path = '/';
    }

    // 拼接目标 URL
    // 注意：使用字符串拼接比 new URL() 更安全，防止 TARGET_DOMAIN 自带子路径被覆盖
    // 假设 TARGET_DOMAIN 是 https://hf.co
    // targetUrl 变成 https://hf.co/management.html
    const targetUrlString = TARGET_DOMAIN.replace(/\/$/, '') + path + url.search;
    const targetUrl = new URL(targetUrlString);

    // 【调试日志】部署后在 Vercel Functions Logs 里可以看到
    console.log(`[Proxy] ${request.method} ${url.pathname} -> ${targetUrl.toString()}`);

    const headers = new Headers(request.headers);
    headers.delete('host');
    // 伪装来源
    headers.set('origin', TARGET_DOMAIN);
    headers.set('referer', TARGET_DOMAIN + '/');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual', // 让浏览器处理重定向
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
