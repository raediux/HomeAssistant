// ── Onboarding — claim member slot or create new household ─────
// Called from ui.js after a session is established but no household_id is found.

let _obTier = 'free';

// ── Visibility helpers ────────────────────────────────────────
function showOnboarding() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('onboarding-overlay').classList.remove('hidden');
}

function _obError(msg) {
  const el = document.getElementById('ob-error');
  if (el) { el.textContent = msg; el.style.display = msg ? '' : 'none'; }
}

function _obBusy(busy) {
  document.querySelectorAll('#onboarding-box button').forEach(b => b.disabled = busy);
}

function setObTier(tier) {
  _obTier = tier;
  document.querySelectorAll('.ob-tier-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tier === tier);
  });
}

// ── Create a brand-new household ─────────────────────────────
async function submitCreateHousehold() {
  _obError('');
  const householdName = document.getElementById('ob-hname').value.trim() || 'Home';
  const memberName    = document.getElementById('ob-mname').value.trim();
  if (!memberName) { document.getElementById('ob-mname').focus(); return; }

  _obBusy(true);
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error('No active session — please sign in again.');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-household`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ household_name: householdName, member_name: memberName, tier: _obTier }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || json.message || `Server error (${res.status})`);

    if (json.checkout_url) {
      // Family tier → redirect to Stripe; on return the webhook handles subscription
      window.location.href = json.checkout_url;
      return;
    }

    setHouseholdId(json.household_id);
    document.getElementById('onboarding-overlay').classList.add('hidden');
    document.dispatchEvent(new Event('ha:authed'));
    location.reload();
  } catch (e) {
    console.error('submitCreateHousehold:', e);
    _obError(e.message || 'Could not create household. Please try again.');
    _obBusy(false);
  }
}

// ── Enter key support ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ob-mname')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitCreateHousehold();
  });
  document.getElementById('ob-hname')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('ob-mname')?.focus();
  });
});
