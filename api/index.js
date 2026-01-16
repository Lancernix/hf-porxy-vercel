export const config = {
  runtime: 'edge',
  // 完美覆盖：Render(美西) + Zeabur(新加坡/雅加达)
  regions: ["pdx1", "sin1", "sfo1", "iad1"],
};

// 默认超时 60秒
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '60000', 10);

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 代理请求函数 - 纯净版
 * 移除内部计时，交由外层控制，保持函数功能单一
 */
async function proxyToService(targetUrl, method, headers, bodyBuffer) {
  const proxyHeaders = new Headers(headers);
  proxyHeaders.delete('host');
  proxyHeaders.set('origin', targetUrl.origin);
  proxyHeaders.set('referer', targetUrl.origin + '/');
  proxyHeaders.set('Connection', 'keep-alive');

  // bodyBuffer 为 null 时传 undefined，符合 fetch 标准
  return await fetchWithTimeout(targetUrl, {
    method,
    headers: proxyHeaders,
    body: bodyBuffer || undefined, 
    redirect: 'manual',
  }, TIMEOUT_MS);
}

function buildTargetUrl(baseDomain, pathname, search) {
  const domain = baseDomain.replace(/\/$/, '');
  const path = pathname.startsWith('/') ? pathname : '/' + pathname;
  return new URL(domain + path + search);
}

function shouldRetry(response) {
  return response.status >= 500;
}

export default async function handler(request) {
  const SERVICE_1 = process.env.SERVICE_1;
  const SERVICE_2 = process.env.SERVICE_2;

  if (!SERVICE_1 || !SERVICE_2) {
    return new Response('Error: SERVICE_1 and SERVICE_2 must be set.', { status: 500 });
  }

  // 1. 处理 OPTIONS
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
    
    let pathname = url.pathname;
    if (pathname.startsWith('/api')) {
      pathname = pathname.replace(/^\/api/, '');
    }
    const search = url.search;

    // 2. 缓存 Body
    let bodyBuffer = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        bodyBuffer = await request.arrayBuffer();
      } catch (e) {
        console.error('[Proxy] Failed to read request body', e);
        return new Response('Invalid request body', { status: 400 });
      }
    }

    // 3. 负载均衡选择
    const services = [SERVICE_1, SERVICE_2];
    const primaryIdx = Math.floor(Math.random() * 2);
    const primaryService = services[primaryIdx];
    const backupService = services[1 - primaryIdx];

    console.log(`[Proxy] ${request.method} ${pathname} -> Primary: ${primaryService}`);

    // 4. 尝试首选服务
    let targetUrl = buildTargetUrl(primaryService, pathname, search);
    let response;
    let primaryError = null;
    
    // 【优化】计时逻辑外置，确保报错也能记录时间
    const t1 = Date.now(); 
    let duration1 = 0;

    try {
      response = await proxyToService(targetUrl, request.method, request.headers, bodyBuffer);
      duration1 = Date.now() - t1;

      if (shouldRetry(response)) {
        console.warn(`[Proxy] Primary returned ${response.status} (${duration1}ms), switching to backup...`);
        response = null; 
      } else {
        console.log(`[Proxy] Primary succeeded: ${response.status} (${duration1}ms)`);
      }
    } catch (error) {
      duration1 = Date.now() - t1; // 捕获超时或网络错误的耗时
      console.error(`[Proxy] Primary failed (${duration1}ms): ${error.message}`);
      primaryError = error;
      response = null;
    }

    // 5. 尝试备用服务 (如果首选失败)
    if (!response) {
      console.log(`[Proxy] Attempting backup: ${backupService}`);
      targetUrl = buildTargetUrl(backupService, pathname, search);
      
      const t2 = Date.now();
      let duration2 = 0;

      try {
        response = await proxyToService(targetUrl, request.method, request.headers, bodyBuffer);
        duration2 = Date.now() - t2;
        console.log(`[Proxy] Backup succeeded: ${response.status} (${duration2}ms)`);
      } catch (error) {
        duration2 = Date.now() - t2;
        console.error(`[Proxy] Backup also failed (${duration2}ms): ${error.message}`);
        
        return new Response(
          JSON.stringify({ 
            error: 'Service Unavailable: Both upstreams failed.',
            details: {
              primary: `${primaryError?.message || '5xx Error'} (${duration1}ms)`,
              backup: `${error.message} (${duration2}ms)`
            }
          }),
          {
            status: 503,
            headers: { 'content-type': 'application/json' },
          }
        );
      }
    }

    // 6. 透传响应
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
    console.error('[Proxy Internal Error]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
