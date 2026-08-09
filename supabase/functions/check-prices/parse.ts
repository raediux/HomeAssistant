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

  // Some sites (Adairs among them) emit schema.org keys with the "@" stripped,
  // so a strict @type lookup silently skips their Product block entirely.
  const types = ([] as unknown[]).concat(obj['@type'] ?? obj.type ?? []).map(t => String(t).toLowerCase());
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

  for (const key of ['@graph', 'graph', 'mainEntity', 'itemListElement', 'hasVariant']) {
    const hit = findProductPrice(obj[key], depth + 1);
    if (hit) return hit;
  }
  return null;
}

// Pull one balanced JSON value out of a larger document, starting at the first
// `open` bracket after `from`. Quote- and escape-aware, because product titles
// routinely contain braces that would defeat naive bracket counting.
function sliceJson(html: string, from: number, open: '[' | '{'): string | null {
  const close = open === '[' ? ']' : '}';
  const start = html.indexOf(open, from);
  if (start === -1) return null;
  let depth = 0, inStr = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close && --depth === 0) return html.slice(start, i + 1);
  }
  return null;
}

export type Variant = { label: string; price: number };

// Retailers that render the price client-side leave nothing usable in JSON-LD or
// meta tags, but do embed it in the page's app state. One small reader per site,
// tried before the generic parsers. A reader may return a list of options
// (sizes, colours) instead of a single price.
type AdapterResult = { price?: number | null; variants?: Variant[]; reason?: string };
type Adapter = { host: RegExp; extract: (html: string) => AdapterResult };

const ADAPTERS: Adapter[] = [
  {
    // Officeworks: app state carries the price in cents, keyed by SKU.
    host: /(^|\.)officeworks\.com\.au$/,
    extract: h => ({ price: toNum(Number(h.match(/"price":\{"[A-Z0-9-]+":\{"price":(\d+)/)?.[1]) / 100) }),
  },
  {
    // Amazon: the buy-box JSON is the only number worth trusting. Amazon
    // intermittently serves servers a reduced page with no priceAmount at all,
    // whose stray visible prices belong to other offers — reading one of those
    // is where $326.61 came from on a $399 item. No priceAmount, no price.
    host: /(^|\.)amazon\.com\.au$/,
    extract: h => ({
      price: toNum(h.match(/"priceAmount":\s*([\d.]+)/)?.[1]),
      reason: 'Amazon served a reduced page with no buy-box price — it does this to servers at random. Try again later, or enter the price yourself.',
    }),
  },
  {
    // Adairs: per-size prices live under `prices.variantGroups`. Anchoring on that
    // key matters — the same page also carries `sizeSelections` blocks belonging to
    // cross-sell products (a mattress protector there lists its own "Single"), and
    // reading those would track the wrong item with nothing looking wrong.
    host: /(^|\.)adairs\.com\.au$/,
    extract: h => {
      const at = h.indexOf('"variantGroups"');
      if (at === -1) return {};
      const raw = sliceJson(h, at, '[');
      if (!raw) return {};
      let groups: unknown;
      try { groups = JSON.parse(raw); } catch { return {}; }
      if (!Array.isArray(groups)) return {};

      const variants: Variant[] = [];
      for (const group of groups) {
        const items = (group as Record<string, unknown>)?.items;
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          const it = item as Record<string, unknown>;
          const p = it.price as Record<string, unknown> | undefined;
          // promotionPrice is what you'd actually pay when a sale is on;
          // linenLoversPrice is the membership rate and is deliberately ignored.
          const price = toNum(p?.promotionPrice ?? p?.price);
          const label = typeof it.title === 'string' ? it.title.trim() : '';
          if (label && price) variants.push({ label, price });
        }
      }
      return variants.length ? { variants } : {};
    },
  },
];

export type Parsed = {
  price: number | null;
  currency: string | null;
  title: string | null;
  image: string | null;
  source: string | null;
  variants?: Variant[];
  /** A variant was pinned but the page no longer lists that label. */
  variantMissing?: boolean;
  /** Why a site-specific reader declined to report a price. */
  reason?: string;
};

type ParseOpts = { priceRegex?: string | null; variant?: string | null };

export function parseHtml(html: string, url: string, opts: ParseOpts = {}): Parsed {
  const { priceRegex, variant } = opts;
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
    const res = adapter.extract(html);
    if (res.variants?.length) {
      out.variants = res.variants;
      if (!variant) return out;   // caller picks one; guessing a size would be worse than no price
      const hit = res.variants.find(v => v.label.toLowerCase() === variant.toLowerCase());
      // Never substitute a different option — silently tracking the wrong size is
      // the one failure that looks like success.
      if (!hit) { out.variantMissing = true; return out; }
      out.price = hit.price;
      out.source = 'adapter';
      return out;
    }
    if (res.price) { out.price = res.price; out.source = 'adapter'; return out; }
    // The reader recognised the site but refused to vouch for a number. Carry
    // its explanation; the generic parsers below may still find something valid.
    if (res.reason) out.reason = res.reason;
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
  'adairs.com.au': 'Adairs',
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
