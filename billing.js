// Billing — Stripe checkout + subscription gate
// Waits for PIN dismissal, then checks for an active subscription in Supabase.
// If none found, shows the paywall overlay.

const BILLING_CACHE_KEY = 'ha_billing';
const BILLING_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Wait for auth + onboarding to complete ────────────────────
// ha:authed may already have fired (microtask) before DOMContentLoaded (macrotask),
// so also check overlay visibility as a fallback.
function waitForAuth() {
  return new Promise(resolve => {
    const authEl = document.getElementById('auth-overlay');
    const obEl   = document.getElementById('onboarding-overlay');
    const done   = () => authEl?.classList.contains('hidden') && obEl?.classList.contains('hidden');
    if (done()) { resolve(); return; }
    document.addEventListener('ha:authed', () => resolve(), { once: true });
  });
}

// ── Subscription check ────────────────────────────────────────
async function billingIsActive() {
  // Serve from cache when fresh
  try {
    const c = JSON.parse(localStorage.getItem(BILLING_CACHE_KEY) || 'null');
    if (c && c.active && (Date.now() - c.ts < BILLING_CACHE_TTL)) return true;
  } catch {}

  try {
    const { data, error } = await db
      .from('subscriptions').select('status').eq('status', 'active').limit(1);
    if (error) throw error;
    const active = !!(data && data.length > 0);
    localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify({ active, ts: Date.now() }));
    return active;
  } catch (e) {
    console.warn('Billing check failed:', e);
    return false; // fail open so a DB error doesn't lock everyone out
  }
}

// ── Start Stripe Checkout ─────────────────────────────────────
async function billingSubscribe() {
  const emailInput = document.getElementById('billing-email');
  // Fall back to the authenticated user's email if input is empty
  let email = emailInput ? emailInput.value.trim() : '';
  if (!email) {
    const { data: { session } } = await db.auth.getSession();
    email = session?.user?.email ?? '';
    if (emailInput) emailInput.value = email;
  }
  if (!email || !email.includes('@')) {
    if (emailInput) emailInput.focus();
    return;
  }

  const btn = document.getElementById('billing-subscribe-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  const errEl = document.getElementById('billing-error');
  if (errEl) errEl.style.display = 'none';

  try {
    const { data: { session } } = await db.auth.getSession();
    const hid = await getMyHouseholdId();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, household_id: hid }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    window.location.href = json.url;
  } catch (e) {
    console.error('Checkout error:', e);
    if (btn) { btn.disabled = false; btn.textContent = 'Subscribe'; }
    if (errEl) { errEl.textContent = 'Could not start checkout. Please try again.'; errEl.style.display = ''; }
  }
}

// ── Poll after Stripe redirect back ───────────────────────────
async function billingPollActive(maxMs = 30000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const { data } = await db.from('subscriptions').select('status').eq('status', 'active').limit(1);
    if (data && data.length > 0) return true;
    await new Promise(r => setTimeout(r, 2500));
  }
  return false;
}

// ── UI helpers ────────────────────────────────────────────────
function billingShowOverlay()    { document.getElementById('billing-overlay').classList.remove('hidden'); }
function billingHideOverlay()    { document.getElementById('billing-overlay').classList.add('hidden'); }
function billingShowProcessing() {
  billingShowOverlay();
  document.getElementById('billing-main').style.display       = 'none';
  document.getElementById('billing-processing').style.display = 'flex';
}

// ── Init ──────────────────────────────────────────────────────
async function initBilling() {
  await waitForAuth();

  const params        = new URLSearchParams(window.location.search);
  const checkoutState = params.get('checkout');
  if (checkoutState) history.replaceState({}, '', window.location.pathname);

  if (checkoutState === 'success') {
    billingShowProcessing();
    const ok = await billingPollActive();
    if (ok) {
      localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify({ active: true, ts: Date.now() }));
      billingHideOverlay();
    } else {
      // Webhook still processing — show form with a note
      document.getElementById('billing-main').style.display       = '';
      document.getElementById('billing-processing').style.display = 'none';
      const errEl = document.getElementById('billing-error');
      if (errEl) {
        errEl.textContent = 'Payment received — subscription still activating. Please refresh in a moment.';
        errEl.style.display = '';
      }
    }
    return;
  }

  const active = await billingIsActive();
  if (!active) billingShowOverlay();
}

document.addEventListener('DOMContentLoaded', initBilling);
