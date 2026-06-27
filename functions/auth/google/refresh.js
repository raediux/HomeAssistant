export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization') || '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${jwt}`,
    },
  });
  if (!userRes.ok) return new Response('Unauthorized', { status: 401 });
  const { id: userId } = await userRes.json();

  const dbRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/google_tokens?user_id=eq.${userId}&select=refresh_token`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  const rows = await dbRes.json();
  if (!rows?.length) return new Response('No token', { status: 404 });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: rows[0].refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenRes.ok) return new Response('Refresh failed', { status: 502 });
  const tokens = await tokenRes.json();

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/google_tokens?user_id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        access_token: tokens.access_token,
        expires_at: expiresAt,
      }),
    }
  );

  return new Response(JSON.stringify({ access_token: tokens.access_token, expires_at: expiresAt }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
