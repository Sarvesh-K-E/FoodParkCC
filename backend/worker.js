export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);

    // --- PostHog Reverse Proxy for Analytics ---
    if (url.pathname.startsWith('/api/data')) {
      const postHogUrl = new URL(request.url);
      postHogUrl.hostname = 'us.i.posthog.com';
      postHogUrl.pathname = postHogUrl.pathname.replace('/api/data', '');
      
      let newRequest = new Request(postHogUrl.toString(), request);
      newRequest.headers.set('Host', 'us.i.posthog.com');
      newRequest.headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
      
      const postHogResponse = await fetch(newRequest);
      const proxyResponse = new Response(postHogResponse.body, postHogResponse);
      proxyResponse.headers.set('Access-Control-Allow-Origin', '*');
      return proxyResponse;
    }
    // -------------------------------------------
    const targetBaseUrl = 'https://vit-proodle.expertsoftsys.com';
    const targetUrl = targetBaseUrl + url.pathname + url.search;

    const proxyRequest = new Request(targetUrl, request);

    proxyRequest.headers.set('Origin', targetBaseUrl);
    proxyRequest.headers.set('Referer', targetBaseUrl + '/');

    if (url.pathname.includes('GetOrderList')) {
      proxyRequest.headers.set('Content-Type', 'application/json; charset=utf-8');
    }

    const response = await fetch(proxyRequest);
    const proxyResponse = new Response(response.body, response);
    
    proxyResponse.headers.set('Access-Control-Allow-Origin', '*');

    return proxyResponse;
  },
};
