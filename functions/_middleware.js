const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://vvowkcqeklvfgqlbevce.supabase.co wss://vvowkcqeklvfgqlbevce.supabase.co https://api.openweathermap.org https://www.googleapis.com https://oauth2.googleapis.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join('; ');

export async function onRequest({ request, next }) {
  if (request.cf?.country !== 'AU') {
    return new Response('Access denied', { status: 403 });
  }
  const response = await next();
  response.headers.set('Content-Security-Policy', CSP);
  return response;
}
