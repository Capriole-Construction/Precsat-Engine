/**
 * Capriole CORS Proxy — Cloudflare Worker
 *
 * Deploy this in Cloudflare Dashboard → Workers → capriole-proxy → Edit Code
 * Paste this entire file, then click "Save and Deploy"
 *
 * Fixes: OPTIONS preflight must return CORS headers for WebDAV (PROPFIND/PUT/DELETE)
 * to work from browser-based apps (GitHub Pages, localhost, etc.)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PROPFIND,MKCOL,COPY,MOVE,LOCK,UNLOCK,OPTIONS,PATCH,HEAD',
  'Access-Control-Allow-Headers': 'authorization,content-type,depth,destination,overwrite,if,lock-token,timeout,x-http-method-override,x-requested-with,accept,dav',
  'Access-Control-Max-Age': '86400',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // ── CORS preflight ────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── Get target URL ────────────────────────────────────────────
  const url = new URL(request.url);
  const target = url.searchParams.get('url');

  if (!target) {
    return new Response('Missing ?url= parameter', {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
    });
  }

  // ── Forward request ───────────────────────────────────────────
  try {
    const forwardHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      if (k.toLowerCase() !== 'host') forwardHeaders.set(k, v);
    }

    const hasBody = !['GET', 'HEAD'].includes(request.method);

    const response = await fetch(target, {
      method:   request.method,
      headers:  forwardHeaders,
      body:     hasBody ? request.body : null,
      redirect: 'follow',
    });

    // ── Return response with CORS headers ─────────────────────
    const outHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) outHeaders.set(k, v);

    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    outHeaders,
    });

  } catch (err) {
    return new Response('Proxy error: ' + err.message, {
      status:  502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
    });
  }
}
