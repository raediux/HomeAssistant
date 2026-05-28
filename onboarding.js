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

// ── Section toggle ────────────────────────────────────────────
function showCreateHousehold() {
  document.getElementById('ob-claim-section').style.display = 'none';
  document.getElementById('ob-create-section').style.display = '';
  _obError('');
  setTimeout(() => document.getElementById('ob-mname').focus(), 50);
}

function showClaimSection() {
  document.getElementById('ob-create-section').style.display = 'none';
  document.getElementById('ob-claim-section').style.display = '';
  _obError('');
}

function setObTier(tier) {
  _obTier = tier;
  document.querySelectorAll('.ob-tier-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tier === tier);
  });
}

// ── Claim a pre-seeded member slot ────────────────────────────
async function claimMember(name) {
  _obError('');
  _obBusy(true);
  try {
    const { data: { session } } = await db.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/claim-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);

    setHouseholdId(json.household_id);
    document.getElementById('onboarding-overlay').classList.add('hidden');
    document.dispatchEvent(new Event('ha:authed'));
    location.reload();
  } catch (e) {
    _obError(e.message || 'Could not claim slot — it may already be taken.');
    _obBusy(false);
  }
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
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-household`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ household_name: householdName, member_name: memberName, tier: _obTier }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);

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
