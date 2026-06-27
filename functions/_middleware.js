export async function onRequest({ request, next }) {
  if (request.cf?.country !== 'AU') {
    return new Response('Access denied', { status: 403 });
  }
  return next();
}
