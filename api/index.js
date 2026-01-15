export const config = {
  runtime: 'edge',
  regions: ["sfo1", "pdx1", "iad1"],
};

export default async function handler(request) {
  const TARGET_DOMAIN = process.env.TARGET_DOMAIN;

  if (!TARGET_DOMAIN) {
    return new Response('Error: TARGET_DOMAIN is not set.', { status: 500 });
  }

  // 1. 处理 OPTIONS 预检请求
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

    // 2. 获取路径
    let pathname = url.pathname;
    
    // 确保路径为空时默认为 /
    if (!pathname) {
      pathname = '/';
    }

    // 3. 构建目标 URL
    const targetUrlString = TARGET_DOMAIN.replace(/\/$/, '') + pathname + url.search;
    const targetUrl = new URL(targetUrlString);

    // 4. 打印日志
    console.log(`[Proxy] ${request.method} ${request.url} -> ${targetUrl.toString()}`);

    // 5. 转发请求
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

    // 6. 处理响应
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
