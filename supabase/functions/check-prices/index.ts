// check-prices — reads each tracked product page, records the current price,
// and flags anything that has dropped.
//
// Two callers:
//   • pg_cron (service_role JWT) → checks every household, once daily.
//   • the app  (user JWT)        → checks just that user's household ("Check now"),
//                                  or probes a single URL to prefill the add form.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseHtml, storeFromUrl, type Parsed } from './parse.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML = 3_000_000;   // large product pages run ~2MB; past this is boilerplate
const BATCH = 5;              // concurrent fetches — one slow site can't stall the run

// Retailers serve a different (often price-free) page to unknown clients, so we
// identify as a mainstream desktop browser and ask for Australian pricing.
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
};

// Only public web addresses — never let a saved URL point back at internal infrastructure.
function safeUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return null;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return null;
  if (h === '::1' || h.startsWith('[')) return null;
  return u;
}

type FetchResult =
  | { ok: true; parsed: Parsed }
  | { ok: false; status: 'blocked' | 'http_error' | 'bad_url'; error: string };

type ParseOpts = { priceRegex?: string | null; variant?: string | null };

async function fetchAndParse(url: string, opts: ParseOpts = {}): Promise<FetchResult> {
  const safe = safeUrl(url);
  if (!safe) return { ok: false, status: 'bad_url', error: 'Not a valid public http(s) address' };

  let res: Response;
  try {
    res = await fetch(safe.href, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: REQUEST_HEADERS,
    });
  } catch (e) {
    return { ok: false, status: 'http_error', error: `Request failed: ${(e as Error).message}` };
  }

  if (!res.ok) {
    // 403/429/503 means the retailer turned us away, not that the link is dead —
    // worth distinguishing, because the fix (enter the price by hand) differs.
    const refused = res.status === 403 || res.status === 429 || res.status === 503;
    return {
      ok: false,
      status: refused ? 'blocked' : 'http_error',
      error: `HTTP ${res.status}${refused ? ' — site declined the request' : ''}`,
    };
  }

  const html = (await res.text()).slice(0, MAX_HTML);
  return { ok: true, parsed: parseHtml(html, safe.href, opts) };
}

// ── checking one retailer link ────────────────────────────────

// A price nobody has been able to confirm for this long stops counting toward
// "cheapest". Quoting a bargain from a link that has been unreadable for a week
// is worse than showing the next-best price we can actually stand behind.
const STALE_DAYS = 3;

type Source = {
  id: number; item_id: number; url: string; store: string | null; image_url: string | null;
  variant: string | null; price_regex: string | null; manual: boolean;
  current_price: number | null; lowest_price: number | null; last_ok_at: string | null;
};

type Item = {
  id: number; name: string; image_url: string | null; currency: string | null;
  current_price: number | null; lowest_price: number | null; highest_price: number | null;
  target_price: number | null; drop_pct: number | null; on_sale: boolean;
  best_source_id: number | null;
  sources: Source[];
};

type SourceOutcome = {
  source: Source;
  price: number | null;     // newly read, or the retained previous price
  okAt: string | null;      // when this price was last confirmed
  image: string | null;
};

// deno-lint-ignore no-explicit-any
async function checkSource(admin: any, src: Source): Promise<SourceOutcome> {
  const now = new Date().toISOString();
  const prev = src.current_price == null ? null : Number(src.current_price);
  const keep = { source: src, price: prev, okAt: src.last_ok_at, image: null };

  const result = await fetchAndParse(src.url, {
    priceRegex: src.price_regex,
    variant: src.variant,
  });

  // A failed read keeps the last known price — a stale number labelled stale
  // is more useful than a blank row.
  if (!result.ok) {
    await admin.from('price_sources').update({
      last_checked_at: now, last_status: result.status, last_error: result.error,
    }).eq('id', src.id);
    return keep;
  }

  const { parsed } = result;

  if (parsed.price == null) {
    // A pinned option that vanished gets its own message: the link still works,
    // so "no price found" would send you hunting in the wrong place.
    const reason = parsed.variantMissing
      ? `Option "${src.variant}" is no longer listed — the page's options may have changed`
      : 'No price found on the page (JSON-LD and meta tags both empty)';
    await admin.from('price_sources').update({
      last_checked_at: now, last_status: 'parse_failed', last_error: reason,
      image_url: src.image_url ?? parsed.image,
    }).eq('id', src.id);
    return keep;
  }

  const price = parsed.price;

  // A 10× swing usually means we grabbed a bundle or RRP figure, not the price.
  if (prev != null && prev > 0 && (price / prev < 0.1 || price / prev > 10)) {
    await admin.from('price_sources').update({
      last_checked_at: now, last_status: 'parse_failed',
      last_error: `Implausible change ($${prev} → $${price}) — ignored`,
    }).eq('id', src.id);
    return keep;
  }

  const patch: Record<string, unknown> = {
    current_price: price,
    previous_price: prev,
    lowest_price: src.lowest_price == null ? price : Math.min(Number(src.lowest_price), price),
    last_checked_at: now, last_ok_at: now,
    last_status: 'ok', last_error: null,
  };
  if (!src.image_url && parsed.image) patch.image_url = parsed.image;
  if (!src.store) patch.store = storeFromUrl(src.url);

  await admin.from('price_sources').update(patch).eq('id', src.id);
  return { source: src, price, okAt: now, image: parsed.image };
}

// ── rolling several retailers up into one product ─────────────

function isEligible(o: SourceOutcome, nowMs: number): boolean {
  if (o.price == null) return false;
  // A hand-entered price has no page to re-read, so it never goes stale.
  if (o.source.manual) return true;
  if (!o.okAt) return false;
  return nowMs - new Date(o.okAt).getTime() <= STALE_DAYS * 86_400_000;
}

// deno-lint-ignore no-explicit-any
async function rollUpItem(admin: any, item: Item, outcomes: SourceOutcome[]) {
  const now = new Date().toISOString();
  const eligible = outcomes.filter(o => isEligible(o, Date.now()));

  // Every link is unreadable or stale — hold the last known figures rather than
  // blanking the card. The per-retailer rows carry the explanation.
  if (!eligible.length) return { id: item.id, ok: false, dropped: false, newAlert: false };

  const winner = eligible.reduce((a, b) => (b.price! < a.price! ? b : a));
  const best = winner.price!;
  const prevBest = item.current_price == null ? null : Number(item.current_price);

  const target  = item.target_price == null ? null : Number(item.target_price);
  const dropPct = item.drop_pct == null ? null : Number(item.drop_pct);
  const hitTarget = target != null && best <= target;
  const hitDrop   = dropPct != null && prevBest != null && prevBest > 0
    && ((prevBest - best) / prevBest) * 100 >= dropPct;

  let onSale = hitTarget || hitDrop;
  // A week-long sale shouldn't un-flag itself on day two just because the price
  // held steady — stay flagged until it climbs back up.
  if (!onSale && item.on_sale && prevBest != null && best <= prevBest) onSale = true;

  const patch: Record<string, unknown> = {
    current_price: best,
    previous_price: prevBest,
    lowest_price:  item.lowest_price  == null ? best : Math.min(Number(item.lowest_price), best),
    highest_price: item.highest_price == null ? best : Math.max(Number(item.highest_price), best),
    best_source_id: winner.source.id,
    on_sale: onSale,
  };
  if (onSale && !item.on_sale) { patch.seen = false; patch.sale_since = now; }
  if (!onSale) patch.sale_since = null;
  if (!item.image_url) {
    const img = outcomes.find(o => o.image)?.image ?? outcomes.find(o => o.source.image_url)?.source.image_url;
    if (img) patch.image_url = img;
  }

  await admin.from('price_items').update(patch).eq('id', item.id);

  // Only record genuine movements of the headline price — keeps the table small
  // and the sparkline honest.
  if (prevBest == null || best !== prevBest) {
    await admin.from('price_history').insert({ item_id: item.id, price: best, checked_at: now });
  }

  return {
    id: item.id, ok: true, price: best, prev: prevBest,
    dropped: prevBest != null && best < prevBest,
    newAlert: onSale && !item.on_sale,
  };
}

// ── entrypoint ────────────────────────────────────────────────

function decodeJwtRole(header: string | null): string | null {
  const token = (header ?? '').replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role ?? null;
  } catch { return null; }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const auth = req.headers.get('Authorization');
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const isService = decodeJwtRole(auth) === 'service_role';

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  // ── probe: read one URL and report back, saving nothing ──
  if (typeof body.probe === 'string') {
    const variant = typeof body.variant === 'string' ? body.variant : null;
    const result = await fetchAndParse(body.probe, { variant });
    if (!result.ok) return json({ ok: false, status: result.status, error: result.error });
    return json({
      ok: true,
      price:    result.parsed.price,
      currency: result.parsed.currency,
      title:    result.parsed.title,
      image:    result.parsed.image,
      source:   result.parsed.source,
      variants: result.parsed.variants ?? null,
      store:    storeFromUrl(body.probe),
    });
  }

  // ── scope: cron sees every household, a user sees only their own ──
  let query = admin.from('price_items')
    .select('id, name, image_url, currency, current_price, lowest_price, highest_price, target_price, drop_pct, on_sale, best_source_id, sources:price_sources(id, item_id, url, store, image_url, variant, price_regex, manual, current_price, lowest_price, last_ok_at)');

  if (!isService) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth ?? '' } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);
    const { data: member } = await admin.from('household_members')
      .select('household_id').eq('user_id', user.id).maybeSingle();
    if (!member?.household_id) return json({ error: 'No household' }, 403);
    query = query.eq('household_id', member.household_id);
  }

  const { data: rows, error } = await query;
  if (error) return json({ error: error.message }, 500);
  const items = (rows ?? []).filter((i: Item) => i.sources?.length) as Item[];
  if (!items.length) return json({ checked: 0, ok: 0, failed: 0, drops: 0, alerts: 0, sources: 0 });

  // Fetch every retailer link across all items in one batched pass, so a product
  // with five shops doesn't serialise behind a product with one.
  const toCheck: Source[] = items.flatMap(i => i.sources.filter(s => !s.manual));
  const byId = new Map<number, SourceOutcome>();
  for (let i = 0; i < toCheck.length; i += BATCH) {
    const slice = toCheck.slice(i, i + BATCH);
    const settled = await Promise.allSettled(slice.map(src => checkSource(admin, src)));
    for (const s of settled) if (s.status === 'fulfilled') byId.set(s.value.source.id, s.value);
  }

  // Manual links aren't fetched, but still count toward the cheapest price.
  const results = [];
  for (const item of items) {
    const outcomes = item.sources.map(src => byId.get(src.id) ?? {
      source: src,
      price: src.current_price == null ? null : Number(src.current_price),
      okAt: src.last_ok_at,
      image: null,
    });
    results.push(await rollUpItem(admin, item, outcomes));
  }

  return json({
    checked: results.length,
    sources: toCheck.length,
    ok:      results.filter(r => r.ok).length,
    failed:  results.filter(r => !r.ok).length,
    drops:   results.filter(r => r.dropped).length,
    alerts:  results.filter(r => r.newAlert).length,
    source:  isService ? 'cron' : 'manual',
  });
});
