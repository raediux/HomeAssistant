export async function onRequest({ request, next }) {
  const country = request.cf?.country;
  if (country && country !== 'AU') {
    return new Response('Access denied', { status: 403 });
  }
  return next();
}
