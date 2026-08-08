// Price extraction from a product page's HTML.
//
// Deliberately dependency-free: Deno has no DOM parser, and the numbers we need
// live in JSON-LD or meta tags, both of which regex handles fine.

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function metaTags(html: string): Record<string, string>[] {
  return [...html.matchAll(/<meta\s+([^>]*?)\/?>/gi)].map(m => parseAttrs(m[1]));
}

function findMeta(metas: Record<string, string>[], keys: string[]): string | null {
  for (const key of keys) {
    const hit = metas.find(a =>
      (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase() === key && a.content
    );
    if (hit) return hit.content;
  }
  return null;
}

// "$1,299.00" / "A$1.299,00" / "1299" → 1299
export function toNum(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[^\d.,]/g, '');
  if (!s) return null;
  // European format: comma is the decimal separator (1.299,00)
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

// Walk arbitrary JSON-LD looking for a Product with an offer price.
function findProductPrice(node: unknown, depth = 0): { price: number; currency?: string } | null {
  if (!node || depth > 8) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findProductPrice(child, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;

  const types = ([] as unknown[]).concat(obj['@type'] ?? []).map(t => String(t).toLowerCase());
  if (types.some(t => t === 'product' || t === 'productgroup') && obj.offers) {
    const offers = ([] as unknown[]).concat(obj.offers as unknown);
    for (const offer of offers) {
      if (!offer || typeof offer !== 'object') continue;
      const o = offer as Record<string, unknown>;
      const price = toNum(o.price ?? o.lowPrice ?? o.highPrice);
      if (price) return { price, currency: o.priceCurrency ? String(o.priceCurrency) : undefined };
      // AggregateOffer nesting its real offers one level down
      const nested = findProductPrice(o.offers, depth + 1);
      if (nested) return nested;
    }
  }

  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'hasVariant']) {
    const hit = findProductPrice(obj[key], depth + 1);
    if (hit) return hit;
  }
  return null;
}

// Retailers that render the price client-side leave nothing in JSON-LD or meta
// tags, but do embed it in the page's app state. One small reader per site,
// tried before the generic parsers.
type Adapter = { host: RegExp; extract: (html: string) => number | null };

const ADAPTERS: Adapter[] = [
  {
    // Officeworks: app state carries the price in cents, keyed by SKU.
    host: /(^|\.)officeworks\.com\.au$/,
    extract: h => toNum(Number(h.match(/"price":\{"[A-Z0-9-]+":\{"price":(\d+)/)?.[1]) / 100),
  },
  {
    // Amazon: buy-box price sits in a JSON blob; the visible span is the fallback.
    host: /(^|\.)amazon\.com\.au$/,
    extract: h => toNum(h.match(/"priceAmount":\s*([\d.]+)/)?.[1])
               ?? toNum(h.match(/class="a-offscreen">\s*\$?([\d,.]+)/)?.[1]),
  },
];

export type Parsed = {
  price: number | null;
  currency: string | null;
  title: string | null;
  image: string | null;
  source: string | null;
};

export function parseHtml(html: string, url: string, priceRegex?: string | null): Parsed {
  const metas = metaTags(html);
  const out: Parsed = { price: null, currency: null, title: null, image: null, source: null };

  const image = findMeta(metas, ['og:image', 'twitter:image']);
  out.image = image ? decodeEntities(image) : null;
  out.title = findMeta(metas, ['og:title', 'twitter:title'])
    ?? html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i)?.[1]?.trim()
    ?? null;
  if (out.title) out.title = decodeEntities(out.title).replace(/\s+/g, ' ').trim();

  // 1. per-item override wins — it exists precisely because the generic paths failed
  if (priceRegex) {
    try {
      const m = html.match(new RegExp(priceRegex, 'i'));
      const price = toNum(m?.[1] ?? m?.[0]);
      if (price) { out.price = price; out.source = 'regex'; return out; }
    } catch { /* bad user regex — fall through to the generic parsers */ }
  }

  // 2. site-specific reader, if we have one for this host
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { /* ignore */ }
  const adapter = ADAPTERS.find(a => a.host.test(host));
  if (adapter) {
    const price = adapter.extract(html);
    if (price) { out.price = price; out.source = 'adapter'; return out; }
  }

  // 3. JSON-LD Product — covers most AU retailers
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const hit = findProductPrice(data);
    if (hit) {
      out.price = hit.price;
      out.currency = hit.currency ?? null;
      out.source = 'json-ld';
      return out;
    }
  }

  // 4. OpenGraph / microdata price meta
  const metaPrice = toNum(findMeta(metas, [
    'og:price:amount', 'product:price:amount', 'price', 'twitter:data1',
  ]));
  if (metaPrice) {
    out.price = metaPrice;
    out.currency = findMeta(metas, ['og:price:currency', 'product:price:currency']);
    out.source = 'meta';
    return out;
  }

  // 5. itemprop="price" on a non-meta element
  const itemprop = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
  const ipPrice = toNum(itemprop?.[1]);
  if (ipPrice) { out.price = ipPrice; out.source = 'itemprop'; return out; }

  return out;
}

const STORE_NAMES: Record<string, string> = {
  'jbhifi.com.au': 'JB Hi-Fi', 'officeworks.com.au': 'Officeworks',
  'bunnings.com.au': 'Bunnings', 'kogan.com': 'Kogan', 'catch.com.au': 'Catch',
  'amazon.com.au': 'Amazon AU', 'ebay.com.au': 'eBay AU', 'thegoodguys.com.au': 'The Good Guys',
  'woolworths.com.au': 'Woolworths', 'coles.com.au': 'Coles', 'bigw.com.au': 'Big W',
  'kmart.com.au': 'Kmart', 'target.com.au': 'Target', 'harveynorman.com.au': 'Harvey Norman',
  'chemistwarehouse.com.au': 'Chemist Warehouse', 'mwave.com.au': 'Mwave',
  'scorptec.com.au': 'Scorptec', 'pccasegear.com': 'PC Case Gear', 'umart.com.au': 'Umart',
};

export function storeFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    for (const [domain, label] of Object.entries(STORE_NAMES)) {
      if (host === domain || host.endsWith('.' + domain)) return label;
    }
    return host;
  } catch { return null; }
}
