export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');

  const home = 'https://homeapp.raediux.com/#calendar';
  const fail = (msg) => Response.redirect(`${home}?google_error=${encodeURIComponent(msg)}`, 302);

  if (!code || !stateRaw) return fail('missing_params');

  let state;
  try { state = JSON.parse(atob(stateRaw)); } catch { return fail('bad_state'); }

  const cookies = Object.fromEntries(
    (request.headers.get('cookie') || '').split(';').map(c => c.trim().split('='))
  );
  if (!state.csrf || cookies['g_csrf'] !== state.csrf) return fail('csrf_mismatch');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: 'https://homeapp.raediux.com/auth/google/callback',
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.json().catch(() => ({}));
    return fail(`token_exchange_failed:${errBody.error}:${errBody.error_description}`);
  }
  const tokens = await tokenRes.json();

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const sbRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/google_tokens`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: state.userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      }),
    }
  );

  if (!sbRes.ok) return fail('db_write_failed');

  return new Response(null, {
    status: 302,
    headers: {
      'Location': home,
      'Set-Cookie': 'g_csrf=; Path=/; Max-Age=0; SameSite=Lax',
    },
  });
}
