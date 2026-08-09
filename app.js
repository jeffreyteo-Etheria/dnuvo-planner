/* ════════════════════════════════════════════════
   d.nuvo Launch Console
   Roles: admin (passcode) · team (open)
   Team never receives cost data — it is stripped
   before render, and floors arrive pre-computed.
   ════════════════════════════════════════════════ */

const KEY = 'dnuvo_console_v1';
const ADMIN_PASS = '1234';
// Shared team-wide passcode — gates the whole site before the team/admin
// role picker even appears. Change this to something the team actually
// knows and keep it out of casual conversation/email; it's a plain
// constant in this file, same trust model as ADMIN_PASS above.
const SITE_PASS = 'dnuvo2026';

let S = {};          // persisted store
let role = null;     // 'admin' | 'team'
let view = 'overview';

/* ── persistence ──
   normalizeState() is the single place that backfills fields a stored
   plan might be missing — a browser's own localStorage, a pulled Live
   sync workspace, a GitHub gist, or a restored session snapshot can all
   predate a field this build expects, and rendering against `undefined`
   crashes rather than showing a stale-but-safe value. Every path that
   replaces S wholesale (not just the boot-time load) must go through
   this, or a same-shaped-but-older payload takes the app down instead
   of just looking behind. */
function normalizeState(obj){
  const s = obj || {};
  s.settings = Object.assign({}, DEFAULTS, s.settings || {});
  s.skus     = s.skus     || SKUS.map(x => Object.assign({}, x));
  s.months   = s.months   || MONTHS.map(m => ({ k:m.k, units:m.units, price:m.price }));
  s.compIntel = s.compIntel || COMPETITOR_INTEL.map(r => Object.assign({}, r));
  s.kols     = s.kols     || [];
  s.requests = s.requests || [];
  s.checks   = s.checks   || {};
  s.gates    = s.gates    || { reviews:0, rating:0, roas:0, pool:0, buyers:0 };
  s.actuals  = s.actuals  || {};
  s.notes    = s.notes    || {};
  s.proposals = s.proposals || [];
  s.bundleOverrides = s.bundleOverrides || {};
  s.schedule = s.schedule || [];
  s.sendLog  = s.sendLog  || [];
  s.eventStatus = s.eventStatus || {};
  s.expansion = s.expansion || {};
  s.expansion.checklist = s.expansion.checklist || {};
  s.expansion.distributors = s.expansion.distributors || [];
  s.personas = s.personas || {};
  s.personas.answers = s.personas.answers || [];
  s.settings.shopfrontLinks = s.settings.shopfrontLinks || Object.assign({}, SHOPFRONT_LINK_DEFAULTS);
  /* Seeded once from a live check of shop.dnuvo.com.sg on 2026-08-09 — after
     that this is team-logged data like everything else here, not re-fetched
     automatically (no backend to do that safely from a static site). */
  s.shopfrontPrices = s.shopfrontPrices || {
    vitc:  { shopify: { price: 35, checkedAt: '2026-08-09' } },
    water: { shopify: { price: 29, checkedAt: '2026-08-09' } },
    sun:   { shopify: { price: 26, checkedAt: '2026-08-09' } },
    toner: { shopify: { price: 25, checkedAt: '2026-08-09' } },
    calm:  { shopify: { price: 39, checkedAt: '2026-08-09' } },
    eye:   { shopify: { price: 29, checkedAt: '2026-08-09' } }
  };
  s.expansion.skuFit = s.expansion.skuFit || {
    malaysia: 'Barrier-repair/ceramide story matches Malaysia\'s premium-import positioning. Lead with the Hero Repair Duo; consider a CNY gift-set bundle for the Chinese-Malaysian segment.',
    thailand: 'Thailand skincare is trending toward "science-based, skin-health" positioning — direct match for d.nuvo\'s barrier-repair claims. Lead with the same hero SKU; no repositioning needed.'
  };
  // A plan saved before shipping/handling existed won't have them on each
  // SKU — backfill rather than let the floor formula read undefined as 0
  // silently everywhere (explicit here, once, instead of scattered ||0s).
  s.skus.forEach(sk => {
    if(sk.shipping == null) sk.shipping = 0;
    if(sk.handling == null) sk.handling = 0;
  });
  s.settings.platformFees = Object.assign({}, PLATFORM_FEES, s.settings.platformFees || {});
  s.settings.promoDiscounts = Object.assign(
    {}, ...PROMO_PERIODS.map(p => ({ [p.k]: p.discountPct })), s.settings.promoDiscounts || {});
  return s;
}
function load(){
  let parsed;
  try{ parsed = JSON.parse(localStorage.getItem(KEY) || '{}'); }catch(e){ parsed = {}; }
  S = normalizeState(parsed);
}
let saveT;
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
  markLocalEdit();
  const d = el('saveDot'); if(!d) return;
  d.classList.add('on'); clearTimeout(saveT);
  saveT = setTimeout(()=>d.classList.remove('on'), 1100);
}

/* When this browser last changed the plan — compared against Live sync's
   lastPush/lastPull so boot-time auto-pull can tell "safe to replace
   silently" from "this browser has edits the workspace hasn't seen yet." */
const LOCAL_EDIT_KEY = 'dnuvo_localedit_v1';
function markLocalEdit(){
  try{ localStorage.setItem(LOCAL_EDIT_KEY, new Date().toISOString()); }catch(e){}
}
function lastLocalEditAt(){
  try{ return localStorage.getItem(LOCAL_EDIT_KEY) || null; }catch(e){ return null; }
}

/* ── helpers ── */
const el  = id => document.getElementById(id);
const qs  = (s,r=document) => r.querySelector(s);
const qsa = (s,r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; };
const cur = n => S.settings.cur + Math.round(n).toLocaleString();
const isAdmin = () => role === 'admin';

function toast(msg){
  const t = el('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._x); t._x = setTimeout(()=>t.hidden = true, 2400);
}

/* Floor price. Computed server-side of the ACL boundary —
   team sees the result, never the cost that produced it. */
/* Floor price for a SKU on a given platform — the minimum price that still
   clears shipping, handling, COGS and the platform fee with 3×COGS left
   over as profit. 4×COGS in the numerator = 1× to recover cost + 3× the
   required margin. Shopify (0% fee) is the default since it's the lead
   price every other channel is priced against. */
function feeFor(platformKey){
  const fees = (S.settings && S.settings.platformFees) || PLATFORM_FEES;
  return fees[platformKey] != null ? fees[platformKey] : 0;
}
function floorOf(sku, platformKey){
  const fee = feeFor(platformKey || 'shopify');
  return (4 * sku.cogs + (sku.shipping||0) + (sku.handling||0)) / (1 - fee);
}
function maxDiscount(sku, platformKey){
  const f = floorOf(sku, platformKey);
  if(!sku.sale || sku.sale <= f) return 0;
  return Math.floor((1 - f / sku.sale) * 100);
}

/* ═══════════ AUTH ═══════════ */
/* Shared site passcode — the very first thing anyone sees. Independent of
   the team/admin picker below it; unlocking this just reveals that picker,
   it doesn't pick a role itself. */
function initSiteGate(){
  const tryUnlock = () => {
    if(el('sitePwInput').value === SITE_PASS){
      el('siteGate').hidden = true;
      el('gate').hidden = false;
      el('sitePwInput').value = '';
    } else {
      el('sitePwErr').textContent = 'That passcode does not match. Try again.';
      el('sitePwInput').value = ''; el('sitePwInput').focus();
    }
  };
  el('sitePwGo').addEventListener('click', tryUnlock);
  el('sitePwInput').addEventListener('keydown', e => { if(e.key === 'Enter') tryUnlock(); });
  el('sitePwInput').focus();
}
function initGate(){
  qsa('.gate-role').forEach(b => b.addEventListener('click', () => {
    if(b.dataset.role === 'team'){ enter('team'); }
    else { el('gatePw').classList.add('on'); el('pwInput').focus(); }
  }));
  el('pwBack').addEventListener('click', () => {
    el('gatePw').classList.remove('on'); el('pwErr').textContent = ''; el('pwInput').value = '';
  });
  el('pwGo').addEventListener('click', tryPass);
  el('pwInput').addEventListener('keydown', e => { if(e.key === 'Enter') tryPass(); });
}
function tryPass(){
  const v = el('pwInput').value.trim();
  if(v === ADMIN_PASS){ enter('admin'); }
  else {
    el('pwErr').textContent = 'That passcode does not match. Try again.';
    el('pwInput').value = ''; el('pwInput').focus();
  }
}
function enter(r){
  role = r;
  el('gate').hidden = true;
  el('app').hidden = false;
  applyACL();
  renderWho();
  boot();
  // Paint immediately from whatever's local, then check the shared workspace
  // in the background — this is what makes "latest data" not depend on
  // someone remembering to click Pull.
  if(typeof liveSyncAutoPullOnBoot === 'function') liveSyncAutoPullOnBoot();
}
function applyACL(){
  qsa('.nav-i').forEach(b => {
    b.hidden = (b.dataset.acl === 'admin' && !isAdmin());
  });
  qsa('.adm-only').forEach(n => { n.style.display = isAdmin() ? '' : 'none'; });
}
function renderWho(){
  el('whoBox').innerHTML = isAdmin()
    ? `<div class="who-av admin">AD</div><div class="who-t"><b>Administrator</b><span>Full access</span></div>`
    : `<div class="who-av team">TM</div><div class="who-t"><b>Team member</b><span>Workflow access</span></div>`;
}
el('signOut').addEventListener('click', () => location.reload());

/* ═══════════ NAV ═══════════ */
const VIEW_META = {
  overview :['Overview','Where the launch stands today.'],
  strategy :['Strategy','Positioning, phases and the rules that hold them.'],
  brandpulse:['Brand pulse','Competitor intelligence, personas, and site audit alignment.'],
  pricing  :['Pricing','Tiered architecture across three platforms.'],
  media    :['Media plan','Budget, and every dollar named to a product.'],
  expansion:['MY/TH expansion','Regulatory path, distributor candidates and market fit for Malaysia and Thailand.'],
  kol      :['KOL hub','Source, verify, brief and manage creators.'],
  content  :['Content','Brand-persona AI prompts for ad hooks and creative.'],
  events   :['Events','Activations, pop-ups and live sessions.'],
  calendar :['6-month calendar','Six months, and the first eight weeks in detail. For real creator booking dates, see KOL hub → Post → Calendar.'],
  pending  :['Pending changes','Proposed by the team. Nothing is applied until you decide.'],
  approvals:['Requests & flags','General asks and issues from the team.'],
  report   :['Reporting','Actuals against plan.'],
  aistrategy:['AI strategy','Orchestrate modules and generate connected monthly actions.']
};
function go(v){
  view = v;
  qsa('.nav-i').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  qsa('.view').forEach(s => s.classList.toggle('on', s.dataset.view === v));
  const m = VIEW_META[v] || ['',''];
  el('viewTitle').textContent = m[0];
  el('viewSub').textContent = m[1];
  el('scroll').scrollTop = 0;
}
qsa('.nav-i').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
el('printBtn').addEventListener('click', () => window.print());

/* ═══════════ GATE RAIL (signature) ═══════════ */
function renderRail(){
  el('railTrack').innerHTML = GATES.map(g => {
    const cur_ = S.gates[g.id] || 0;
    const open = cur_ >= g.target;
    const cls  = open ? 'open' : '';
    const val  = g.id === 'rating' ? cur_.toFixed(1) : Math.round(cur_);
    const tgt  = g.id === 'rating' ? g.target.toFixed(1) : g.target;
    return `<div class="rail-node ${cls}" title="${esc(g.unlocks)} — ${esc(g.why)}">
      <span class="rn-dot"></span>
      <span class="rn-txt"><b>${esc(g.label)}</b><span>${val} / ${tgt}</span></span>
    </div>`;
  }).join('');
  // first unmet gate is "next"
  const nodes = qsa('.rail-node');
  for(let i=0;i<GATES.length;i++){
    if(!(S.gates[GATES[i].id] >= GATES[i].target)){ nodes[i].classList.add('next'); break; }
  }
}

/* ═══════════ BUDGET ENGINE ═══════════ */
/* M1-M3: flat baseBudget each month — committed spend to build proof and
   momentum into 11.11, independent of that month's own sales. M4-M6: 30%
   of the PRIOR month's revenue — budget becomes self-funded once the
   front-loaded push is done, rather than assuming continued cash input.
   This is a deliberately different shape from a smooth reinvestment ramp:
   a real step down at the M3→M4 boundary, not a curve. */
function computeBudget(){
  const st = S.settings;
  const margin = st.marginPct/100, reinvest = st.reinvestPct/100;
  let prevRev = 0;
  return S.months.map((m,i) => {
    const meta = MONTHS[i];
    const rev = m.units * m.price;
    const profit = rev * margin;
    const budget = i < 3 ? st.baseBudget : prevRev * reinvest;
    prevRev = rev;
    const split = (S.splitOverrides && S.splitOverrides[m.k]) || meta.split;
    const ch = {};
    Object.keys(meta.split).forEach(k => ch[k] = budget * (split[k] ?? meta.split[k]));
    return { k:m.k, label:meta.label, units:m.units, price:m.price, rev, profit, budget, ch, meta, split };
  });
}

/* Suggested channel split for a month — starts from the authored static
   weights, then shifts share toward the marketplace channels (shopee,
   tiktok) and away from search/social retargeting (google, meta) when
   that month has an active marketplace promo period tagged in Campaign
   setup. In-platform flash/mega-sale mechanics convert better inside
   the marketplace itself during a tagged window than channels that
   send traffic away from it. A clear, explainable heuristic — not a
   black box — and always editable by admin via "Apply to this month". */
function recommendSplit(monthIndex){
  const meta = MONTHS[monthIndex];
  const base = Object.assign({}, meta.split);
  const promo = (S.settings.promoPeriods || {});
  const marketplaceActive = ['flash','9.9','10.10','11.11','12.12']
    .some(k => promo[k] && promo[k].active && promo[k].month === meta.k);
  if(!marketplaceActive) return base;

  const SHIFT = 0.06; // move 6 points of share, split evenly from google/meta into shopee/tiktok
  const out = Object.assign({}, base);
  const donors = ['google','meta'].filter(k => (out[k]||0) > 0);
  if(!donors.length) return base;
  const perDonor = Math.min(SHIFT / donors.length, ...donors.map(k => out[k]));
  donors.forEach(k => { out[k] = +(out[k] - perDonor).toFixed(3); });
  const taken = perDonor * donors.length;
  const recipients = ['shopee','tiktok'].filter(k => k in out);
  recipients.forEach(k => { out[k] = +(out[k] + taken/recipients.length).toFixed(3); });
  return out;
}

/* ═══════════ OVERVIEW ═══════════ */
function renderOverview(){
  const B = computeBudget();
  const tU = B.reduce((a,b)=>a+b.units,0);
  const tR = B.reduce((a,b)=>a+b.rev,0);
  const tB = B.reduce((a,b)=>a+b.budget,0);
  const goal = S.settings.goalUnits;
  const pct = tR ? (tB/tR*100) : 0;
  const openGates = GATES.filter(g => (S.gates[g.id]||0) >= g.target).length;

  el('kpiRow').innerHTML = [
    ['Units planned', tU.toLocaleString(), tU>=goal
      ? `<b>meets ${goal.toLocaleString()} goal</b>`
      : `<i>${(goal-tU).toLocaleString()} short of goal</i>`],
    ['Revenue', cur(tR), 'at planned average price'],
    ['Media budget', cur(tB), `${pct.toFixed(1)}% of revenue`],
    ['Gates open', `${openGates}/5`, openGates===5?'<b>all clear</b>':'sequencing holds'],
    ['Creators', String(S.kols.length), `${S.kols.filter(k=>k.stage==='done').length} complete`]
  ].map(([l,v,s]) => `<div class="kpi"><div class="kpi-l">${l}</div>
      <div class="kpi-v">${v}</div><div class="kpi-s">${s}</div></div>`).join('');

  const maxU = Math.max(...B.map(b=>b.units), 1);
  el('chartUnits').innerHTML = B.map(b => `<div class="bar-w">
      <div class="bar-v">${b.units}</div>
      <div class="bar" style="height:${(b.units/maxU)*100}%"></div>
      <div class="bar-l">${b.k}</div></div>`).join('');

  const tot = {};
  Object.keys(CHAN_META).forEach(k => tot[k] = B.reduce((a,b)=>a+(b.ch[k]||0),0));
  const maxC = Math.max(...Object.values(tot), 1);
  el('chartSpend').innerHTML = `<div class="hbars">` + Object.keys(CHAN_META).map(k =>
    `<div class="hb"><span class="hb-l">${CHAN_META[k].name}</span>
      <span class="hb-t"><span class="hb-f" style="width:${(tot[k]/maxC)*100}%;background:${CHAN_META[k].color}"></span></span>
      <span class="hb-v">${cur(tot[k])}</span></div>`).join('') + `</div>`;

  const ph = PHASES.find(p => {
    if(p.n===1) return (S.gates.reviews||0) < 50 || (S.gates.rating||0) < 4.7;
    if(p.n===2) return (S.gates.roas||0) < 1.5;
    return true;
  }) || PHASES[0];
  el('phaseNow').innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span class="pill ${ph.tag}">Phase ${ph.n}</span><b style="font-size:15px">${esc(ph.name)}</b>
      <span class="n" style="margin-left:auto;color:var(--faint);font-size:12px">${ph.months}</span></div>
    <p style="font-size:13px;color:var(--mute);line-height:1.6;margin-bottom:12px">${esc(ph.doing)}</p>
    <div style="padding:11px 14px;background:var(--violet-lt);border-radius:6px;font-size:12.5px;color:var(--violet)">
      <b>Opens the next phase:</b> ${esc(ph.gate)}</div>`;

  // Gate-lock items are capped and summarized rather than filling every slot,
  // so rarer but more actionable signals (pending requests, campaign setup
  // never configured, no creators yet) can't get silently crowded out.
  const gateItems = [];
  GATES.forEach(g => {
    const c = S.gates[g.id]||0;
    if(c < g.target) gateItems.push([g.unlocks + ' is locked',
      `${g.label} at ${g.id==='rating'?c.toFixed(1):Math.round(c)} of ${g.target} ${g.unit}.`, 'p-a']);
  });
  const items = gateItems.slice(0, 3);
  if(gateItems.length > 3) items.push([`${gateItems.length - 3} more gate(s) locked`,
    'See the launch gates rail above for the full list.', 'p-a']);
  if(!S.kols.length) items.push(['No creators yet',
    'The review gate cannot move until creators are sourced and shipped.', 'p-r']);
  const pendingReq = S.requests.filter(r=>r.status==='pending').length;
  if(isAdmin() && pendingReq)
    items.unshift(['Requests waiting', `${pendingReq} request(s)/flag(s) from the team need a decision.`, 'p-v']);
  // Every settings field ships with a working d.nuvo default, so there's no
  // reliable "never configured" signal to detect — this is an always-visible
  // pointer for admins, not a conditional first-run check.
  if(isAdmin()) items.push(['Check Campaign setup is still accurate',
    'Media split, Brand pulse and Pricing shop links all read from Strategy → Campaign setup — worth a look before this launch.', 'p-n']);

  el('attention').innerHTML = items.length
    ? items.map(([t,b,p]) => `<div style="display:flex;gap:11px;padding:9px 0;border-bottom:1px solid var(--line-2)">
        <span class="pill ${p}" style="flex-shrink:0;margin-top:2px">!</span>
        <div><b style="font-size:13px">${esc(t)}</b>
        <div style="font-size:12.5px;color:var(--mute);margin-top:2px">${esc(b)}</div></div></div>`).join('')
    : `<p class="empty">Nothing blocking. Keep to the calendar.</p>`;

  el('roleQuickstart').innerHTML = ROLE_QUICKSTART.map((r, i) =>
    `<div class="rq" data-rq="${i}">
      <div class="rq-h"><b>${esc(r.role)}</b><span>${esc(r.focus)}</span></div>
      <ul class="rq-l">${r.guide.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
      <button class="btn-line sm" data-rqgo="${esc(r.jump)}">Open ${esc((VIEW_META[r.jump]||['section'])[0])}</button>
    </div>`).join('');
  qsa('[data-rqgo]').forEach(b => b.addEventListener('click', () => go(b.dataset.rqgo)));
}

/* ═══════════ STRATEGY ═══════════ */
/* ── Campaign setup — one consolidated admin panel. Media plan's split
   recommendation, the calendar's promo panel, and brand pulse's
   competitor takeaways all read from S.settings written here.      ── */
function renderCampaignSetup(){
  const box = el('campaignSetup');
  if(!box || !isAdmin()) return;
  S.settings.socialHandles = S.settings.socialHandles || {};
  S.settings.platformsActive = S.settings.platformsActive || {};
  S.settings.promoPeriods = S.settings.promoPeriods || {};
  S.settings.competitorUrls = S.settings.competitorUrls || [];

  const heroSkus = S.skus.filter(s => s.role === 'Hero');
  const platformList = [['tiktok','TikTok'],['instagram','Instagram'],['facebook','Facebook'],
    ['shopee','Shopee'],['lazada','Lazada'],['shopify','Shopify']];

  box.innerHTML = `
    <div class="fgrid">
      <label>Brand URL<input data-cs="shopDomain" value="${esc(S.settings.shopDomain)}"></label>
      <label>Location focus<input data-cs="market" value="${esc(S.settings.market)}"></label>
      <label>Shopee handle<input data-csh="shopee" value="${esc(S.settings.socialHandles.shopee||'')}"></label>
      <label>TikTok handle<input data-csh="tiktok" value="${esc(S.settings.socialHandles.tiktok||'')}"></label>
      <label>M1 start month<input data-cs="startMonth" value="${esc(S.settings.startMonth)}" placeholder="e.g. July 2026"></label>
    </div>

    <div class="mf" style="margin-top:13px">
      <label>Competitor info URLs — one per line</label>
      <textarea id="csCompUrls" rows="3" placeholder="shopee.sg/cosrx.official">${esc((S.settings.competitorUrls||[]).join('\n'))}</textarea>
    </div>

    <div class="mf">
      <label>Hero SKUs and bundles</label>
      <p class="fh">${heroSkus.map(s=>esc(s.name)).join(', ') || 'None flagged Hero yet'} ·
        ${BUNDLES.map(b=>esc(b.name)).join(', ')}
        — change hero status per SKU in Pricing.</p>
    </div>

    <div class="mf">
      <label>Platforms to activate</label>
      <div class="check-grid">${platformList.map(([k,name]) => `
        <label class="${S.settings.platformsActive[k]?'on':''}">
          <input type="checkbox" data-csp="${k}" ${S.settings.platformsActive[k]?'checked':''}>${esc(name)}</label>`).join('')}</div>
    </div>

    <div class="mf">
      <label>Promotional periods in range</label>
      <div class="check-grid">${PROMO_PERIODS.map(p => {
        const cfg = S.settings.promoPeriods[p.k] || { active:false, month:'M1' };
        return `<label class="${cfg.active?'on':''}">
          <span class="check-row">
            <input type="checkbox" data-csr="${p.k}" ${cfg.active?'checked':''}>${esc(p.name)}
            ${cfg.active ? `<select data-csrm="${p.k}">${MONTHS.map(m=>`<option value="${m.k}" ${cfg.month===m.k?'selected':''}>${m.k}</option>`).join('')}</select>` : ''}
          </span></label>`;
      }).join('')}</div>
    </div>`;

  qsa('[data-cs]', box).forEach(i => i.addEventListener('change', () => {
    S.settings[i.dataset.cs] = i.value.trim(); save(); renderAll();
  }));
  qsa('[data-csh]', box).forEach(i => i.addEventListener('change', () => {
    S.settings.socialHandles[i.dataset.csh] = i.value.trim(); save(); renderAll();
  }));
  const compUrls = el('csCompUrls');
  if(compUrls) compUrls.addEventListener('change', () => {
    S.settings.competitorUrls = compUrls.value.split('\n').map(s=>s.trim()).filter(Boolean);
    save(); renderAll();
  });
  qsa('[data-csp]', box).forEach(c => c.addEventListener('change', () => {
    S.settings.platformsActive[c.dataset.csp] = c.checked; save(); renderCampaignSetup();
  }));
  qsa('[data-csr]', box).forEach(c => c.addEventListener('change', () => {
    const k = c.dataset.csr;
    const prev = S.settings.promoPeriods[k] || { month:'M1' };
    S.settings.promoPeriods[k] = { active:c.checked, month:prev.month || 'M1' };
    save(); renderAll();
  }));
  qsa('[data-csrm]', box).forEach(s => s.addEventListener('change', () => {
    const k = s.dataset.csrm;
    S.settings.promoPeriods[k] = S.settings.promoPeriods[k] || { active:true };
    S.settings.promoPeriods[k].month = s.value;
    save(); renderAll();
  }));
}

function renderStrategy(){
  renderCampaignSetup();
  el('phaseTable').innerHTML = `<thead><tr><th>Phase</th><th>Months</th><th>Focus</th>
      <th>What happens</th><th>Return</th><th>Gate</th></tr></thead><tbody>` +
    PHASES.map(p => `<tr>
      <td><span class="pill ${p.tag}">Phase ${p.n}</span><b style="display:block;margin-top:5px">${esc(p.name)}</b></td>
      <td class="n">${p.months}</td><td>${esc(p.focus)}</td>
      <td>${esc(p.doing)}</td><td class="n">${esc(p.roas)}</td><td>${esc(p.gate)}</td></tr>`).join('') + `</tbody>`;

  el('rulesBox').innerHTML = RULES.map(r =>
    `<div class="rule"><b>${esc(r.t)}</b><p>${esc(r.b)}</p></div>`).join('');

  if(isAdmin()){
    const f = [['goalUnits','Units goal'],['baseBudget','Flat budget, M1–M3'],
               ['marginPct','Margin %'],['reinvestPct','% of prior month revenue, M4–M6']];
    el('targetFields').innerHTML = f.map(([k,l]) =>
      `<label>${l}<input type="number" data-set="${k}" value="${S.settings[k]}"></label>`).join('');
    qsa('[data-set]').forEach(i => i.addEventListener('input', () => {
      S.settings[i.dataset.set] = num(i.value); save(); renderAll();
    }));
  }
}

/* Per-channel margin/GPM signal for the site audit — built only from data
   the app already has (media split weights, KOL platform GPM, SKU margin).
   Shopify has no paid-media split or KOL platform in this app, so its
   share/GPM stay '—' rather than inventing a number. */
function channelSignal(){
  const splitKeyMap = { shopee:'shopee', tiktok:'tiktok', shopify:null };
  const platformMap = { shopee:['Shopee Live'], tiktok:['TikTok'], shopify:[] };
  const out = {};
  ['shopee','tiktok','shopify'].forEach(ch => {
    const sk = splitKeyMap[ch];
    let share = null, shareTxt = '—';
    if(sk){
      const shares = MONTHS.map(m => m.split[sk] || 0);
      share = shares.reduce((a,b)=>a+b,0) / shares.length;
      shareTxt = Math.round(share*100) + '% of media budget (avg)';
    }
    const plats = platformMap[ch] || [];
    const kolsOn = (S.kols||[]).filter(k => plats.includes(k.platform) && (k.gpm || (k.avgGmv && k.avgViews)));
    let gpm = 0, gpmTxt = '—';
    if(kolsOn.length){
      gpm = kolsOn.reduce((a,k)=>a+computeGpm(k),0) / kolsOn.length;
      gpmTxt = '$' + Math.round(gpm).toLocaleString() + ' avg creator GPM';
    }
    out[ch] = { share, shareTxt, gpm, gpmTxt };
  });
  return out;
}

/* Rule-based competitor → monthly-strategy takeaway. Ties each
   competitor's channel emphasis to whichever month has a marketplace
   promo period tagged in Campaign setup, so the read is actionable
   against the actual plan rather than generic advice. */
function competitorTakeaways(){
  const rows = (S.compIntel && S.compIntel.length) ? S.compIntel : COMPETITOR_INTEL;
  const promoPeriods = S.settings.promoPeriods || {};
  const marketplaceKeys = ['flash','9.9','10.10','11.11','12.12'];
  const taggedMonth = marketplaceKeys
    .map(k => promoPeriods[k])
    .find(cfg => cfg && cfg.active && cfg.month);
  return rows.map(r => {
    const isMarketplace = /shopee|tiktok|lazada/i.test(r.channel || '');
    let action;
    if(isMarketplace && taggedMonth){
      action = `${taggedMonth.month}: match proof density (reviews, before/after) against ${r.competitor}'s ${r.channel} push — do not chase their promo price, chase their evidence.`;
    } else if(isMarketplace){
      action = `Monitor ${r.competitor}'s ${r.channel} pricing weekly — no marketplace promo period is tagged yet in Campaign setup.`;
    } else {
      action = `${r.competitor} is ${r.channel}-led — counter with Shopify science-page depth and lifecycle proof, not marketplace mechanics.`;
    }
    return { competitor:r.competitor, channel:r.channel, action };
  });
}

function blendedSkuMargin(){
  const withMargin = (S.skus||[]).filter(s => s.sale);
  if(!withMargin.length) return 0;
  const pct = withMargin.reduce((a,s)=>a+((s.sale-s.cogs)/s.sale),0) / withMargin.length;
  return Math.round(pct*100);
}

function renderBrandPulse(){
  const guide = el('bpGuide');
  if(guide){
    guide.innerHTML = `<div class="bp-guide">
      <b>How to use this module (non-technical)</b>
      <ol>
        <li>Update competitor watchlist or import CSV in KOL module.</li>
        <li>Score d.nuvo channels in site audit below (Shopee, TikTok Shop, Shopify).</li>
        <li>Review buyer persona fit for the current month campaign.</li>
        <li>Use generated tactics to adjust pricing, media, KOL, and event modules.</li>
      </ol>
    </div>`;
  }

  renderCompPulse();

  const takeaways = el('compTakeaways');
  if(takeaways){
    takeaways.innerHTML = `<div class="bp-tactics">${competitorTakeaways().map(t => `
      <div class="bp-t"><b>${esc(t.competitor)} · ${esc(t.channel)}</b><p>${esc(t.action)}</p></div>`).join('')}</div>`;
  }

  const personas = el('bpPersonas');
  if(personas){
    const fit = S.personaFit || (S.personaFit = { awareness:3, conversion:3, retention:3 });
    const fitScore = p => {
      const ch = p.channels || [];
      const channelCoverage = ch.filter(c => /Shopee|TikTok|Shopify|Lazada|Retail|Instagram/i.test(c)).length;
      const score = Math.round((fit.awareness + fit.conversion + fit.retention + channelCoverage) / 4);
      return Math.max(1, Math.min(5, score));
    };

    const fitDisabled = isAdmin() ? '' : ' disabled';
    personas.innerHTML = `
      <div class="pf-ctl">
        ${isAdmin() ? '' : `<p class="fh" style="grid-column:1/-1">Set by an administrator — these three sliders tune the fit score for every persona below.</p>`}
        <label>Brand awareness strength
          <input type="range" id="pfAw" min="1" max="5" value="${fit.awareness}"${fitDisabled}>
          <span id="pfAwV">${fit.awareness}/5</span>
        </label>
        <label>Conversion readiness
          <input type="range" id="pfCv" min="1" max="5" value="${fit.conversion}"${fitDisabled}>
          <span id="pfCvV">${fit.conversion}/5</span>
        </label>
        <label>Retention strength
          <input type="range" id="pfRt" min="1" max="5" value="${fit.retention}"${fitDisabled}>
          <span id="pfRtV">${fit.retention}/5</span>
        </label>
      </div>
      <div class="pf-grid">
        ${BUYER_PERSONAS.map(p => {
          const s = fitScore(p);
          const tone = s >= 4 ? 'p-g' : s >= 3 ? 'p-a' : 'p-r';
          return `<div class="pf-card">
            <div class="pf-h"><b>${esc(p.name)}</b><span class="pill ${tone}">Fit ${s}/5</span></div>
            <div class="pf-meta">${esc(p.age)} · ${esc(p.market)}</div>
            <p><b>Pain:</b> ${esc(p.pain)}</p>
            <p><b>Trigger:</b> ${esc(p.emotional)}</p>
            <p><b>Psychology:</b> ${esc(p.psychology)}</p>
            <p><b>Entry:</b> ${esc(p.entry)}</p>
            <p><b>Sequence:</b> ${esc(p.sequence)}</p>
            <p><b>Channels:</b> ${esc((p.channels||[]).join(', '))}</p>
          </div>`;
        }).join('')}
      </div>`;

    const upd = () => {
      fit.awareness = +el('pfAw').value;
      fit.conversion = +el('pfCv').value;
      fit.retention = +el('pfRt').value;
      el('pfAwV').textContent = `${fit.awareness}/5`;
      el('pfCvV').textContent = `${fit.conversion}/5`;
      el('pfRtV').textContent = `${fit.retention}/5`;
      save();
      renderBrandPulse();
    };
    ['pfAw','pfCv','pfRt'].forEach(id => {
      const x = el(id);
      if(x) x.addEventListener('input', upd);
    });
  }

  const audit = el('bpAudit');
  if(audit){
    S.siteAudit = Object.assign({}, SITE_AUDIT_TEMPLATE, S.siteAudit || {});
    const sig = channelSignal();
    const row = (k, label) => {
      const r = S.siteAudit[k] || { score:3, issue:'', recommendation:'' };
      const s = sig[k];
      return `<tr>
        <td><b>${label}</b></td>
        <td class="n"><input class="audit-in n" type="number" min="1" max="5" data-audit="${k}|score" value="${esc(r.score)}"></td>
        <td><input class="audit-in" data-audit="${k}|issue" value="${esc(r.issue||'')}" placeholder="Top blocker"></td>
        <td><input class="audit-in" data-audit="${k}|recommendation" value="${esc(r.recommendation||'')}" placeholder="Action to improve"></td>
        <td style="font-size:12px;color:var(--mute)">${esc(s.shareTxt)}<br>${esc(s.gpmTxt)}</td>
      </tr>`;
    };
    audit.innerHTML = `<div class="tb-wrap"><table class="tb" id="auditTable">
      <thead><tr><th>Channel</th><th class="n">Health (1-5)</th><th>Issue</th><th>Recommendation</th><th>Margin / GPM signal</th></tr></thead>
      <tbody>${row('shopee','Shopee')}${row('tiktok','TikTok Shop')}${row('shopify','Shopify')}</tbody>
    </table></div>
    ${isAdmin() ? `<p class="p-note split-note">Blended SKU margin across the price book: <b>${blendedSkuMargin()}%</b> —
      the profitability backdrop behind every channel's numbers above. Admin only — cost is never shown to the team.</p>` : ''}`;
    qsa('[data-audit]').forEach(i => i.addEventListener('change', () => {
      const [k,f] = i.dataset.audit.split('|');
      S.siteAudit[k] = S.siteAudit[k] || {};
      S.siteAudit[k][f] = (f === 'score') ? num(i.value) : i.value.trim();
      save();
      renderBrandPulse();
    }));
  }

  const tactics = el('bpTactics');
  if(tactics){
    const a = S.siteAudit || SITE_AUDIT_TEMPLATE;
    const sig = channelSignal();
    const ideas = [];
    const urgent = (k) => (a[k]?.score||0) <= 3 && (sig[k].gpm > 0 ? sig[k].gpm < 200 : sig[k].share !== null && sig[k].share > 0.2);
    if((a.shopee?.score||0) <= 3) ideas.push(`Shopee: strengthen review acquisition and bundle-led landing pages before raising paid spend.${urgent('shopee')?' Urgent — it is already drawing meaningful budget or creator GPM here is weak.':''}`);
    if((a.tiktok?.score||0) <= 3) ideas.push(`TikTok Shop: run creator demo hooks and live-only time-boxed offers with strict floor checks.${urgent('tiktok')?' Urgent — it is already drawing meaningful budget or creator GPM here is weak.':''}`);
    if((a.shopify?.score||0) <= 3) ideas.push('Shopify: improve science page clarity and lifecycle retention flows before premium upsell pushes.');
    if(!ideas.length) ideas.push('All core channels healthy. Focus on persona-specific creative testing and ROAS scaling cadence.');
    tactics.innerHTML = `<div class="bp-tactics">${ideas.map(t => `<div class="bp-t"><b>Action</b><p>${esc(t)}</p></div>`).join('')}</div>`;
  }
}

/* Builds a copy-paste prompt for an external AI tool rather than calling
   one directly — same pattern as the Content module's prompt builder, so
   there's no new API key/cost/dependency added to a static site. The
   output format asked for matches the competitor tracker's own CSV import
   columns exactly, so the result pastes straight back in with zero new
   parsing code — see caAddToTracker wiring in renderCompPulse. */
function buildCompetitorAnalysisPrompt(name, url){
  return `You are researching a direct competitor to ${S.settings.brand}, a ceramide/barrier-repair skincare brand in ${S.settings.market}.

Competitor: ${name}
URL to research: ${url}

Visit the URL (and any official social/marketplace storefronts linked from it) and report ONLY what you can actually verify there. Leave a field blank rather than estimate — a guess presented as fact is worse than no data.

For each distinct product or bundle you find that competes with ${S.settings.brand}, output ONE row in this exact CSV format (header row first, exactly as shown, no other columns):

competitor,product,product_type,channel,currency,list_price,promo_price,observed_at,key_message,source

- competitor: "${name}"
- product: the product/bundle name as listed
- product_type: e.g. "Ceramide / barrier", "Vitamin C", "Cleanser" — whatever actually applies
- channel: where you found it (Shopee / TikTok Shop / Shopify / Lazada / Instagram / etc.)
- currency: SGD unless the listing itself shows otherwise
- list_price: the listed price, numbers only, blank if not visible
- promo_price: current promo/sale price if any, blank if none
- observed_at: today's date (YYYY-MM-DD)
- key_message: the single strongest claim or hook they're using, in their own words — quote it, don't paraphrase it into something stronger than what they actually said
- source: the exact URL where you found this

Return only the CSV block — header row plus data rows, nothing else.`;
}

/* Competitor research — pricing, listing and content strategy for the
   6 closest competitors. Sole owner of S.compIntel; KOL hub links here
   rather than duplicating this panel. */
function renderCompPulse(){
  const links = el('bpCompLinks');
  if(links){
    const urls = S.settings.competitorUrls || [];
    links.innerHTML = urls.length
      ? `<p class="fh" style="margin-bottom:8px">Competitor links from Strategy → Campaign setup:
          ${urls.map(u => `<a class="src-ln" href="${/^https?:\/\//.test(u)?esc(u):'https://'+esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join(' · ')}</p>`
      : '';
  }
  const box = el('bpWatch'); if(!box) return;
  const compRows = (S.compIntel && S.compIntel.length) ? S.compIntel : COMPETITOR_INTEL;
  const priceTag = (row, key) => {
    const v = row[key]; if(!v) return '—';
    return (row.currency === 'USD' ? '$' : 'S$') + v;
  };
  const rows = compRows.map(r => `
      <tr>
        <td><b>${esc(r.competitor)}</b><span class="sub">${esc(r.product)}</span></td>
        <td>${esc(r.productType)}</td>
        <td>${esc(r.channel)}</td>
        <td class="n">${priceTag(r, 'listPrice')}</td>
        <td class="n">${priceTag(r, 'promoPrice')}</td>
        <td>${esc(r.keyMessage)}</td>
        <td><a class="src-ln" href="${esc(r.source)}" target="_blank" rel="noopener">Source</a></td>
      </tr>`).join('');

  box.innerHTML = `
    <div class="intel-head">
      <span>Observed ${esc((compRows[0]||{}).observedAt || '')} · refresh weekly before decisions</span>
      <button class="btn-line sm" id="expCompCsv">Download tracker CSV</button>
      <button class="btn-line sm" id="impCompCsv">Upload CSV</button>
      <button class="btn-line sm" id="pasteCompCsv">Paste CSV</button>
      <input type="file" id="impCompFile" accept=".csv,text/csv" hidden>
    </div>
    <div class="tb-wrap"><table class="tb" id="compTable">
      <thead><tr><th>Competitor</th><th>Product type</th><th>Channel</th><th class="n">List</th><th class="n">Promo</th><th>Key message</th><th>Link</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>

    <div class="msg-stack">
      ${DNUVO_MESSAGE_STACK.map(m => `<div class="ms-card"><span>${esc(m.lane)}</span><b>${esc(m.text)}</b></div>`).join('')}
    </div>

    <div class="gap-note">
      <b>Market gap focus:</b> most competitors lean on generic hydration language. d.nuvo should lead with delivery depth,
      mechanism education, and claim-safe proof architecture in creator briefs.
    </div>`;

  const dlBtn = el('expCompCsv');
  if(dlBtn) dlBtn.addEventListener('click', () => {
    if(typeof toCSV !== 'function' || typeof dl !== 'function'){
      toast('Export is not available right now');
      return;
    }
    const csvRows = [
      ['competitor','product','product_type','channel','currency','list_price','promo_price','observed_at','key_message','source'],
      ...compRows.map(r => [r.competitor,r.product,r.productType,r.channel,r.currency,r.listPrice,r.promoPrice,r.observedAt,r.keyMessage,r.source])
    ];
    dl('dnuvo-competitor-tracker-' + stamp() + '.csv', toCSV(csvRows), 'text/csv;charset=utf-8');
    toast('Competitor tracker downloaded');
  });

  const normalizeCompRows = rowsIn => rowsIn.filter(r => r.competitor && r.product).map(r => ({
    competitor: r.competitor,
    product: r.product,
    productType: r.product_type || r.producttype || r.category || 'Ceramide / barrier',
    channel: r.platform_channel || r.channel || 'Marketplace',
    currency: (r.currency || 'SGD').toUpperCase(),
    listPrice: r.list_price || r.listprice || '',
    promoPrice: r.promo_price || r.promoprice || '',
    observedAt: r.week_start || r.observed_at || new Date().toISOString().slice(0,10),
    keyMessage: [r.key_message_1, r.key_message_2, r.key_message].filter(Boolean).join(' | '),
    source: r.source_url || r.source || ''
  }));

  // additive=true: adds/updates rows for the competitor(s) present, leaves
  // every other competitor's existing rows untouched. Used by the single-
  // competitor prompt-builder flow, where wiping the whole tracker for one
  // new lookup would be a real loss of prior work.
  const applyImportedRows = (rowsIn, additive) => {
    const normalized = normalizeCompRows(rowsIn);
    if(!normalized.length){
      toast('No valid competitor rows found');
      return;
    }
    if(additive){
      S.compIntel = (S.compIntel && S.compIntel.length) ? S.compIntel : COMPETITOR_INTEL.map(r=>Object.assign({},r));
      normalized.forEach(row => {
        const idx = S.compIntel.findIndex(x => x.competitor === row.competitor && x.product === row.product);
        if(idx >= 0) S.compIntel[idx] = row; else S.compIntel.push(row);
      });
    } else {
      S.compIntel = normalized;
    }
    save();
    renderCompPulse();
    toast(additive ? normalized.length + ' row(s) added to the tracker' : 'Competitor CSV imported');
  };

  const handleCsvText = text => {
    const rowsIn = parseCsvObjects(text);
    applyImportedRows(rowsIn);
  };

  const caUrlInput = el('caUrl'), caNameInput = el('caName');
  const caBuildBtn = el('caBuildPrompt');
  if(caBuildBtn) caBuildBtn.addEventListener('click', () => {
    const name = caNameInput.value.trim(), url = caUrlInput.value.trim();
    if(!name || !url){ toast('Enter a competitor name and URL first'); return; }
    const prompt = buildCompetitorAnalysisPrompt(name, url);
    el('caPromptText').textContent = prompt;
    el('caPromptOut').hidden = false;
  });
  const caCopyBtn = el('caCopyPrompt');
  if(caCopyBtn) caCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(el('caPromptText').textContent)
      .then(()=>toast('Prompt copied')).catch(()=>toast('Select the text and copy manually'));
  });
  const caAddBtn = el('caAddToTracker');
  if(caAddBtn) caAddBtn.addEventListener('click', () => {
    const text = el('caResultText').value;
    if(!text.trim()){ toast('Paste the AI\'s CSV result first'); return; }
    const rowsIn = parseCsvObjects(text);
    applyImportedRows(rowsIn, true);
    el('caResultText').value = '';
  });

  el('impCompCsv').addEventListener('click', () => el('impCompFile').click());
  el('impCompFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => handleCsvText(String(reader.result || ''));
    reader.readAsText(f);
    e.target.value = '';
  });

  el('pasteCompCsv').addEventListener('click', () => {
    modal('Paste competitor CSV', `
      <div class="mf"><label>CSV content</label>
        <textarea id="compCsvText" rows="12" placeholder="Paste CSV from weekly-competitor-tracker.csv"></textarea>
        <p class="fh">Keep header row. At minimum include competitor and product columns.</p>
      </div>`,
      [['Cancel','x'],['Import','ok']], a => {
        if(a !== 'ok') return true;
        handleCsvText(el('compCsvText').value || '');
        return true;
      });
  });
}

function parseCsvObjects(text){
  const lines = splitCsvLines(text || '');
  if(lines.length < 2) return [];
  const headers = lines[0].map(h => normalizeCsvKey(h));
  return lines.slice(1).filter(r => r.some(v => String(v).trim())).map(cols => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (cols[i] == null ? '' : String(cols[i]).trim()); });
    return o;
  });
}

function normalizeCsvKey(key){
  return String(key || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function splitCsvLines(text){
  const out = [];
  let row = [];
  let cell = '';
  let q = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    const nx = text[i+1];
    if(ch === '"'){
      if(q && nx === '"'){ cell += '"'; i++; }
      else q = !q;
      continue;
    }
    if(ch === ',' && !q){ row.push(cell); cell=''; continue; }
    if((ch === '\n' || ch === '\r') && !q){
      if(ch === '\r' && nx === '\n') i++;
      row.push(cell); out.push(row); row=[]; cell='';
      continue;
    }
    cell += ch;
  }
  if(cell.length || row.length){ row.push(cell); out.push(row); }
  return out;
}

function renderAiStrategy(){
  const mod = el('moduleOrchestrator');
  if(mod){
    S.moduleState = S.moduleState || {};
    mod.innerHTML = `<div class="mod-grid">${MODULE_CATALOG.map(m => {
      const on = (S.moduleState[m.id] == null) ? m.defaultOn : !!S.moduleState[m.id];
      const dis = (m.adminOnly && !isAdmin()) ? ' disabled' : '';
      return `<label class="mod-card">
        <input type="checkbox" data-mod="${m.id}"${on?' checked':''}${dis}>
        <b>${esc(m.name)}</b><span>${esc(m.role)}</span>
      </label>`;
    }).join('')}</div>`;
    qsa('[data-mod]', mod).forEach(c => c.addEventListener('change', () => {
      S.moduleState[c.dataset.mod] = c.checked;
      save();
      applyModuleVisibility();
      renderAiStrategy();
    }));
  }

  const gOpen = GATES.filter(g => (S.gates[g.id]||0) >= g.target).length;

  const rec = el('aiRecommendations');
  if(rec){
    const rows = [];

    // Next gate to close — the first metric still below target, in priority order.
    const nextGate = GATES.find(g => !((S.gates[g.id]||0) >= g.target));
    if(nextGate){
      const v = S.gates[nextGate.id] || 0;
      rows.push({ h:`Close the ${nextGate.label} gate`,
        p:`Currently ${v} against a target of ${nextGate.target} (${nextGate.unit}). ${nextGate.why} Clearing it unlocks ${nextGate.unlocks}.` });
    } else {
      rows.push({ h:'All gates cleared', p:'Every launch gate is at or above target. Focus shifts to scaling proven channels within floor-safe promotion limits.' });
    }

    // KOL pipeline health — creators stuck before negotiation vs. those converted.
    const kols = S.kols || [];
    const early = kols.filter(k => k.stage === 'sourced' || k.stage === 'contacted').length;
    const converted = kols.filter(k => ['approved','scheduled','live','done'].includes(k.stage)).length;
    if(early > 0 && converted === 0){
      rows.push({ h:'Move creators past outreach', p:`${early} creator${early===1?'':'s'} sitting at sourced or contacted with none approved yet. Outreach without conversion does not move the reviews gate — prioritize replying and negotiating terms this week.` });
    } else if(converted > 0 && early > converted * 2){
      rows.push({ h:'Outreach is outpacing conversion', p:`${early} creators are still pre-negotiation against ${converted} approved or further along. Narrow sourcing and spend more time closing the ones already in conversation.` });
    }

    // Weakest brand-audit channel (see Brand pulse site audit).
    const audit = S.siteAudit || SITE_AUDIT_TEMPLATE;
    const weakest = Object.entries(audit).sort((a,b) => (a[1].score||0)-(b[1].score||0))[0];
    if(weakest && (weakest[1].score||0) <= 3){
      const chName = { shopee:'Shopee', tiktok:'TikTok Shop', shopify:'Shopify' }[weakest[0]] || weakest[0];
      rows.push({ h:`${chName} needs attention before scaling`,
        p: weakest[1].issue ? `Flagged issue: ${weakest[1].issue}. Fix this before adding paid spend there.` : `Health score is ${weakest[1].score}/5 — the lowest of the three channels. Review it before adding paid spend there.` });
    }

    // Plan pacing against the unit goal.
    const B = computeBudget();
    const totalPlanUnits = B.reduce((a,b)=>a+b.units,0);
    const goal = S.settings.goalUnits;
    if(goal && totalPlanUnits < goal * 0.9){
      rows.push({ h:'Plan is under the unit goal', p:`The six-month plan totals ${totalPlanUnits.toLocaleString()} units against a goal of ${goal.toLocaleString()}. Raise monthly targets or add a channel before the gap compounds.` });
    }

    rows.push({ h:'Persona fit for creative', p:'Use the buyer persona fit panel in Brand pulse to decide which creative hook to test next month.' });

    rec.innerHTML = `<div class="ai-rec">${rows.map(r=>`<div class="ai-r"><b>${esc(r.h)}</b><p>${esc(r.p)}</p></div>`).join('')}</div>`;
  }

  const tbl = el('orchestratorTable');
  if(tbl){
    const focusFor = i => {
      if(gOpen >= GATES.length) return 'All gates clear — scale with disciplined promotions';
      if(i < 2) return 'Build trust and reviews';
      if(i < 4) return gOpen >= 2 ? 'Activate proven channels' : 'Hold paid activation until gates catch up';
      return gOpen >= 4 ? 'Scale with disciplined promotions' : 'Scale cautiously — some gates still open';
    };
    const promoFor = m => {
      const entry = Object.entries(S.settings.promoPeriods||{}).find(([k,cfg]) => cfg.active && cfg.month === m.k);
      if(!entry) return '—';
      const p = PROMO_PERIODS.find(x => x.k === entry[0]);
      return p ? p.name : entry[0];
    };
    const splitHeadline = i => {
      const split = recommendSplit(i);
      const top = Object.entries(split).sort((a,b)=>b[1]-a[1])[0];
      if(!top || !top[1]) return '—';
      const name = CHAN_META[top[0]] ? CHAN_META[top[0]].name : top[0];
      return `${name} ${Math.round(top[1]*100)}%`;
    };
    tbl.innerHTML = `<thead><tr><th>Month</th><th>Strategy focus</th><th>Media</th><th>KOL</th><th>Retail / events</th><th>Promo period</th><th>Suggested split</th></tr></thead><tbody>` +
      MONTHS.map((m,i) => `<tr>
        <td><b>${esc(m.label)}</b></td>
        <td>${esc(focusFor(i))}</td>
        <td>${esc(m.media)}</td>
        <td>${esc(m.kolWork)}</td>
        <td>${esc(m.events)}</td>
        <td>${esc(promoFor(m))}</td>
        <td>${esc(splitHeadline(i))}</td>
      </tr>`).join('') + `</tbody>`;
  }
}

function applyModuleVisibility(){
  const state = S.moduleState || {};
  MODULE_CATALOG.forEach(m => {
    const on = (state[m.id] == null) ? m.defaultOn : !!state[m.id];
    const nav = qs(`.nav-i[data-view="${m.view}"]`);
    const sec = qs(`.view[data-view="${m.view}"]`);
    if(nav) nav.style.display = on ? '' : 'none';
    if(sec) sec.style.display = on ? '' : 'none';
    if(sec && !on && view === m.view) go('overview');
  });
}

/* ═══════════ PRICING ═══════════ */
function renderPricing(){
  el('tierBox').innerHTML = TIERS.map(t =>
    `<div class="tier ${t.k}"><div class="tier-n">${esc(t.name)}</div>
      <div class="tier-p">${esc(t.range)}</div>
      <div class="tier-r">${esc(t.role)}</div><p>${esc(t.body)}</p></div>`).join('');

  el('chanLogic').innerHTML = CHAN_LOGIC.map(c =>
    `<div class="cl"><div class="cl-h"><b>${esc(c.name)}</b><span class="pill ${c.pill}">${esc(c.goal.split(' · ')[0])}</span></div>
      <div class="cl-goal">${esc(c.goal)}</div>
      <ul>${c.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></div>`).join('');

  el('cogsNote').innerHTML = isAdmin()
    ? 'Cost and floor visible — admin'
    : 'Cost is hidden. Floor and discount ceiling are calculated for you.';

  const head = isAdmin()
    ? `<th>Product</th><th>Tier</th><th class="n">MSRP</th><th class="n">Sale</th><th class="n">Cost</th><th class="n">Floor</th><th class="n">Max off</th><th>Role</th><th class="n">Units</th>`
    : `<th>Product</th><th>Tier</th><th class="n">MSRP</th><th class="n">Sale</th><th class="n">Cost</th><th class="n">Floor</th><th class="n">Max off</th><th>Role</th><th class="n">Units</th>`;

  el('skuTable').innerHTML = `<thead><tr>${head}</tr></thead><tbody>` + S.skus.map((s,i) => {
    const fl = floorOf(s), md = maxDiscount(s);
    const costCell = isAdmin()
      ? `<td class="n">${cell('sku', s.id, 'cogs', s.cogs, s.name + ' — cost per unit', {prefix:S.settings.cur})}</td>`
      : `<td class="n"><span class="masked" title="Cost is not shown at your access level">••••</span></td>`;
    const u = (typeof shopUrlFor === 'function') ? shopUrlFor(s) : '';
    return `<tr>
      <td><b>${esc(s.name)}</b><span class="sub">${esc(s.spec)}</span>
        ${u?`<a class="shop-ln" href="${esc(u)}" target="_blank" rel="noopener" title="Open on the store">↗ shop</a>`:''}</td>
      <td><span class="pill p-n">${esc(s.tier)}</span></td>
      <td class="n">${S.settings.cur}${s.msrp}</td>
      <td class="n">${cell('sku', s.id, 'sale', s.sale, s.name + ' — sale price', {prefix:S.settings.cur})}</td>
      ${costCell}
      <td class="n">${S.settings.cur}${fl.toFixed(2)}</td>
      <td class="n"><span class="pill ${md>=20?'p-g':md>=10?'p-a':'p-r'}">${md}%</span></td>
      <td>${esc(s.role)}<span class="sub">${esc(s.roleNote)}</span></td>
      <td class="n">${s.units}</td></tr>`;
  }).join('') + `</tbody>`;

  wireCells();

  el('floorHint').className = 'hint-bar warn';
  el('floorHint').innerHTML = isAdmin()
    ? `<b>Floor formula.</b> Cost × 2.5, grossed up for the ~16% marketplace commission, plus S$0.50 processing. Confirm real cost with the supplier before publishing any promotion.`
    : `<b>Floor is already calculated.</b> Keep every promotion above the floor shown. If a planned discount breaks it, use the simulator below and request a change — an administrator will review it.`;

  el('bundleTable').innerHTML = `<thead><tr><th>Bundle</th><th>Contents</th><th>Tier</th>
      <th class="n">Price</th><th class="n">Sum of parts</th><th class="n">Saving</th><th>Where it is used</th></tr></thead><tbody>` +
    BUNDLES.map(bRaw => {
      const b = bundleView(bRaw);
      const parts = b.parts.map(p => S.skus.find(s=>s.id===p)).filter(Boolean);
      const sum = parts.reduce((a,s)=>a+s.sale,0);
      const off = sum ? Math.round((1-b.price/sum)*100) : 0;
      return `<tr><td><b>${esc(b.name)}</b><span class="sub">${esc(b.note)}</span></td>
        <td style="font-size:12.5px">${parts.map(p=>esc(p.name.split(' ').slice(0,2).join(' '))).join(' + ')}</td>
        <td><span class="pill p-n">${esc(b.tier)}</span></td>
        <td class="n">${cell('bundle', b.id, 'price', b.price, b.name + ' — price', {prefix:S.settings.cur})}</td>
        <td class="n" style="color:var(--faint)">${S.settings.cur}${sum}</td>
        <td class="n"><span class="pill ${off>25?'p-a':'p-g'}">${off}%</span></td>
        <td>${esc(b.stage)}</td></tr>`;
    }).join('') + `</tbody>`;

  wireCells();
  if(typeof renderShopSync === 'function') renderShopSync();
  if(typeof renderShopfrontLinks === 'function') renderShopfrontLinks();
  if(typeof renderShopfrontPriceTable === 'function') renderShopfrontPriceTable();
  if(typeof renderPromoGrid === 'function') renderPromoGrid();
  if(typeof renderPromoPriceTable === 'function') renderPromoPriceTable();
  renderSim();
}

function renderSim(){
  const opts = S.skus.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join('');
  const platOpts = SHOPFRONT_PLATFORMS.map(p =>
    `<option value="${p.k}"${p.k==='shopee'?' selected':''}>${esc(p.name)} — ${(feeFor(p.k)*100).toFixed(0)}% fee</option>`
  ).join('');
  el('simBox').innerHTML = `
    <div class="sim-ctl">
      <label>Product</label><select id="simSku">${opts}</select>
      <label>Platform</label>
      <select id="simCh">${platOpts}</select>
      <label>Discount <span class="sim-val" id="simPctV">15%</span></label>
      <input type="range" id="simPct" min="0" max="50" value="15">
    </div>
    <div class="sim-out" id="simOut"></div>`;

  const costInput = (s, field) => isAdmin()
    ? `<input type="number" step="0.01" min="0" class="audit-in" style="max-width:90px" data-simcost="${field}" value="${s[field]||0}">`
    : cur(s[field]||0);

  const upd = () => {
    const s = S.skus[+el('simSku').value];
    const platformKey = el('simCh').value;
    const fee = feeFor(platformKey);
    const pct = +el('simPct').value;
    el('simPctV').textContent = pct + '%';
    const net = s.sale * (1 - pct/100);
    const fl = floorOf(s, platformKey);
    const ok = net >= fl;
    const afterFee = net * (1 - fee);
    const netProfit = afterFee - s.cogs - (s.shipping||0) - (s.handling||0);
    const requiredProfit = 3 * s.cogs;
    const profitOk = netProfit >= requiredProfit;

    const rows = [
      ['Listed price', cur(s.sale), ''],
      [`Discount ${pct}%`, '−' + cur(s.sale - net), ''],
      ['Customer pays', cur(net), 'hero'],
      [`Platform fee (${(fee*100).toFixed(0)}%)`, '−' + cur(net - afterFee), '']
    ];
    if(isAdmin()){
      rows.push(['Shipping', costInput(s, 'shipping'), '']);
      rows.push(['Handling', costInput(s, 'handling'), '']);
      rows.push(['Cost of goods', cur(s.cogs), '']);
      rows.push(['Net profit', cur(netProfit), profitOk ? '' : 'fail']);
      rows.push([profitOk ? 'Clears 3× COGS profit' : 'Below 3× COGS profit',
        profitOk ? cur(netProfit - requiredProfit) + ' of headroom' : cur(requiredProfit - netProfit) + ' short',
        profitOk ? 'pass' : 'fail']);
    }
    rows.push(['Floor price', cur(fl), '']);
    rows.push([ok ? 'Clears the floor' : 'Breaks the floor',
      ok ? cur(net - fl) + ' of headroom' : cur(fl - net) + ' below', ok ? 'pass' : 'fail']);
    el('simOut').innerHTML = rows.map(([l,v,c]) =>
      `<div class="so-row ${c}"><span>${l}</span><b>${v}</b></div>`).join('') +
      (!ok && !isAdmin() ? `<div style="padding:11px 15px;border-top:1px solid var(--line)">
        <button class="btn-line sm" id="simReq">Propose this as the new sale price</button></div>` : '');

    qsa('[data-simcost]', el('simOut')).forEach(inp => inp.addEventListener('change', () => {
      s[inp.dataset.simcost] = num(inp.value);
      save();
      upd();
    }));
    const rb = el('simReq');
    if(rb) rb.addEventListener('click', () => {
      // This is a real sale-price change on a real SKU field, so it goes
      // through the same structured proposal system as editing the price
      // book directly — not the free-text request system, which never
      // actually applies anything on approval.
      const applied = propose('sku', s.id, 'sale', String(s.sale), String(Math.round(net*100)/100),
        `${s.name} — ${pct}% discount breaks the floor by ${cur(fl-net)}`);
      if(applied){ toast('Sent for approval — see Pending changes'); renderSim(); }
      else toast('That is already the current sale price');
    });
  };
  ['simSku','simCh','simPct'].forEach(id => {
    el(id).addEventListener('input', upd); el(id).addEventListener('change', upd);
  });
  upd();
}

/* ═══════════ MEDIA ═══════════ */
let budgetTableView = 'all';

/* Shared with Reporting's Monthly actuals table (renderReport) so an actual
   entered from either place is the same field, not a duplicate source of
   truth. Returns false (and leaves S.actuals untouched) if a gate field
   doesn't parse as a number. */
function saveActualField(monthKey, field, raw){
  const gateFields = ['reviews','rating','roas','pool','buyers'];
  if(raw && gateFields.includes(field) && num(raw) === 0 && raw !== '0') return false;
  S.actuals[monthKey] = S.actuals[monthKey] || {};
  S.actuals[monthKey][field] = raw;
  const last = Object.values(S.actuals).filter(a=>a.reviews||a.rating||a.roas||a.pool||a.buyers).pop();
  if(last){
    if(last.reviews) S.gates.reviews = num(last.reviews);
    if(last.rating)  S.gates.rating  = num(last.rating);
    if(last.roas)    S.gates.roas    = num(last.roas);
    if(last.pool)    S.gates.pool    = num(last.pool);
    if(last.buyers)  S.gates.buyers  = num(last.buyers);
  }
  save();
  return true;
}

function renderMedia(){
  const B = computeBudget();
  const canEdit = isAdmin();
  const chK = Object.keys(CHAN_META);
  const activeMonth = Number.isInteger(S.mediaFocus) ? S.mediaFocus : 0;

  const mf = el('mediaMonthFocus');
  if(mf){
    mf.innerHTML = MONTHS.map((m,i) =>
      `<button class="mf-btn ${i===activeMonth?'on':''}" data-mf="${i}">${esc(m.k)}<span>${esc(m.label)}</span></button>`
    ).join('');
    qsa('[data-mf]').forEach(b => b.addEventListener('click', () => {
      qsa('[data-mf]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      const idx = +b.dataset.mf;
      S.mediaFocus = idx;
      el('allocMonth').value = String(idx);
      save();
      renderAlloc();
      renderSplitSuggestion();
      if(budgetTableView === 'month') renderMedia();
      if(typeof renderKolBudgetDrilldown === 'function') renderKolBudgetDrilldown();
      if(typeof renderKolActivityTopline === 'function') renderKolActivityTopline();
    }));
  }

  const roasHead = budgetTableView === 'month' ? '<th class="n">Target ROAS</th><th class="n">Actual ROAS</th><th>Result</th>' : '';
  const rowsSource = budgetTableView === 'month' ? [B[activeMonth]] : B;
  el('budgetTable').innerHTML = `<thead><tr><th>Month</th><th class="n">Units</th><th class="n">Avg price</th>
      <th class="n">Revenue</th>${canEdit?'<th class="n">Profit</th>':''}<th class="n">Budget</th>
      ${chK.map(k=>`<th class="n">${CHAN_META[k].name}</th>`).join('')}${roasHead}</tr></thead><tbody>` +
    rowsSource.map((b,rowI) => {
      const i = budgetTableView === 'month' ? activeMonth : rowI;
      let roasCells = '';
      if(budgetTableView === 'month'){
        const target = targetRoasFor(i);
        const actualRaw = (S.actuals[b.k]||{}).roas || '';
        const actualNum = num(actualRaw);
        const result = !actualRaw ? `<span class="pill p-n">No data yet</span>`
          : actualNum >= target ? `<span class="pill p-g">On track</span>`
          : `<span class="pill p-r">Behind</span>`;
        roasCells = `<td class="n">${target.toFixed(2)}×</td>
          <td class="n"><span class="ed" contenteditable="true" data-actroas="${b.k}">${esc(actualRaw)}</span></td>
          <td>${result}</td>`;
      }
      return `<tr>
      <td><b>${b.label}</b></td>
      <td class="n">${cell('month', b.k, 'units', b.units, b.label + ' — units target')}</td>
      <td class="n">${cell('month', b.k, 'price', b.price, b.label + ' — average price', {prefix:S.settings.cur})}</td>
      <td class="n">${cur(b.rev)}</td>
      ${canEdit?`<td class="n">${cur(b.profit)}</td>`:''}
      <td class="n"><b style="color:var(--violet)">${cur(b.budget)}</b></td>
      ${chK.map(k=>`<td class="n">${b.ch[k]?cur(b.ch[k]):'—'}</td>`).join('')}${roasCells}</tr>`;
    }).join('') +
    (budgetTableView === 'month' ? '' : `<tr class="tot"><td>Total</td><td class="n">${B.reduce((a,b)=>a+b.units,0).toLocaleString()}</td><td class="n">—</td>
      <td class="n">${cur(B.reduce((a,b)=>a+b.rev,0))}</td>
      ${canEdit?`<td class="n">${cur(B.reduce((a,b)=>a+b.profit,0))}</td>`:''}
      <td class="n">${cur(B.reduce((a,b)=>a+b.budget,0))}</td>
      ${chK.map(k=>`<td class="n">${cur(B.reduce((a,b)=>a+(b.ch[k]||0),0))}</td>`).join('')}</tr>`) + `</tbody>`;

  wireCells();
  qsa('[data-actroas]').forEach(c => c.addEventListener('blur', () => {
    const k = c.dataset.actroas;
    const raw = c.textContent.trim();
    if(!saveActualField(k, 'roas', raw)){
      toast(`"${raw}" doesn't look like a number — actual ROAS was not saved`);
      c.textContent = (S.actuals[k]||{}).roas || '';
      return;
    }
    renderRail(); renderOverview(); renderMedia();
  }));

  const kpiBox = el('monthKpiFocus');
  if(kpiBox){
    if(budgetTableView === 'month'){
      const m = MONTHS[activeMonth];
      kpiBox.hidden = false;
      kpiBox.className = 'hint-bar';
      kpiBox.innerHTML = `<b>${esc(m.label)} focus.</b> ${esc(m.media)} ${m.kolWork ? '— ' + esc(m.kolWork) : ''}`;
    } else {
      kpiBox.hidden = true;
    }
  }

  const tU = B.reduce((a,b)=>a+b.units,0), goal = S.settings.goalUnits;
  const tB = B.reduce((a,b)=>a+b.budget,0), tR = B.reduce((a,b)=>a+b.rev,0);
  const gc = el('goalCheck');
  if(tU >= goal){
    gc.className = 'hint-bar ok';
    gc.innerHTML = `<b>On target.</b> ${tU.toLocaleString()} units against a goal of ${goal.toLocaleString()}. Media ${cur(tB)} — ${(tB/tR*100).toFixed(1)}% of revenue.`;
  } else {
    gc.className = 'hint-bar bad';
    gc.innerHTML = `<b>${(goal-tU).toLocaleString()} units short.</b> Raise monthly targets or extend the window. Media ${cur(tB)}.`;
  }
  if(!canEdit){
    gc.innerHTML += ` <button class="btn-line sm" id="reqMedia" style="margin-left:8px">Request a change</button>`;
    const rb = el('reqMedia');
    if(rb) rb.addEventListener('click', () => openRequest('Media plan', 'Monthly units or budget', '', '', ''));
  }

  const sel = el('allocMonth');
  if(!sel.options.length){
    sel.innerHTML = B.map((b,i)=>`<option value="${i}">${b.label}</option>`).join('');
    sel.value = String(activeMonth);
    sel.addEventListener('change', () => {
      S.mediaFocus = +sel.value;
      save();
      qsa('[data-mf]').forEach(x => x.classList.toggle('on', +x.dataset.mf === S.mediaFocus));
      renderAlloc();
      renderSplitSuggestion();
      if(budgetTableView === 'month') renderMedia();
      if(typeof renderKolBudgetDrilldown === 'function') renderKolBudgetDrilldown();
      if(typeof renderKolActivityTopline === 'function') renderKolActivityTopline();
    });
  }
  renderAlloc();
  renderSplitSuggestion();

  el('chanBriefs').innerHTML = CHAN_BRIEFS.map((c,i) =>
    `<div class="cb ${i===0?'open':''}"><div class="cb-h">
      <b>${esc(c.name)}</b><span class="pill ${c.pill}">${esc(c.role)}</span>
      <span style="font-size:11.5px;color:var(--faint)">${esc(c.owner)}</span>
      <span class="cb-x">+</span></div>
      <div class="cb-b"><dl>${c.rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div></div>`).join('');
  qsa('.cb-h').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));
}

const budgetViewAllBtn = el('budgetViewAll');
const budgetViewMonthBtn = el('budgetViewMonth');
function setBudgetTableView(v){
  budgetTableView = v;
  if(budgetViewAllBtn) budgetViewAllBtn.classList.toggle('on', v === 'all');
  if(budgetViewMonthBtn) budgetViewMonthBtn.classList.toggle('on', v === 'month');
  renderMedia();
}
if(budgetViewAllBtn) budgetViewAllBtn.addEventListener('click', () => setBudgetTableView('all'));
if(budgetViewMonthBtn) budgetViewMonthBtn.addEventListener('click', () => setBudgetTableView('month'));

function renderSplitSuggestion(){
  const box = el('splitSuggestion'); if(!box) return;
  const i = Number.isInteger(S.mediaFocus) ? S.mediaFocus : 0;
  const meta = MONTHS[i];
  const current = (S.splitOverrides && S.splitOverrides[meta.k]) || meta.split;
  const suggested = recommendSplit(i);
  const chK = Object.keys(CHAN_META);
  const changed = chK.some(k => Math.abs((suggested[k]||0) - (current[k]||0)) > 0.001);

  box.innerHTML = `<div class="split-panel">
    <div class="tb-wrap"><table class="tb">
      <thead><tr><th>Channel</th><th class="n">Current</th><th class="n">Suggested</th></tr></thead>
      <tbody>${chK.map(k => `<tr><td>${esc(CHAN_META[k].name)}</td>
        <td class="n">${Math.round((current[k]||0)*100)}%</td>
        <td class="n">${changed ? `<b class="sug-up">${Math.round((suggested[k]||0)*100)}%</b>` : Math.round((suggested[k]||0)*100)+'%'}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="split-note">${changed
      ? `Marketplace promo period active in ${esc(meta.k)} — shifted share from Google/Meta toward Shopee/TikTok.`
      : `No marketplace promo period tagged for ${esc(meta.k)} — suggestion matches the authored plan.`}</p>
    ${isAdmin() ? `<button class="btn-line sm" id="applySplitBtn" ${changed?'':'disabled'}>Apply to this month</button>` : ''}
  </div>`;

  const applyBtn = el('applySplitBtn');
  if(applyBtn) applyBtn.addEventListener('click', () => {
    S.splitOverrides = S.splitOverrides || {};
    S.splitOverrides[meta.k] = suggested;
    save(); renderAll();
    toast('Applied — ' + meta.k + ' now uses the suggested split');
  });
}

/* ═══════════ MY/TH EXPANSION ═══════════
   Research reference (EXPANSION_MARKETS/EXPANSION_CHECKLIST, data.js) is
   static and sourced. Distributor candidates and SKU-fit notes are live
   state — the candidates list starts empty on purpose; nothing here
   invents a real company or contact. */
function renderExpansion(){
  const marketsBox = el('expMarkets');
  if(marketsBox){
    marketsBox.innerHTML = `<div class="promo-grid">${EXPANSION_MARKETS.map(m => `
      <div class="promo-card">
        <span>${esc(m.name)}</span><b>${esc(m.stat)}</b>
        <p>${esc(m.fit)}</p>
        <p style="font-size:11px;color:var(--faint);margin-top:6px">Source: ${esc(m.source)}</p>
      </div>`).join('')}</div>`;
  }

  const checklistBox = el('expChecklist');
  if(checklistBox){
    checklistBox.innerHTML = Object.keys(EXPANSION_CHECKLIST).map(mk => {
      const marketName = (EXPANSION_MARKETS.find(m=>m.k===mk)||{}).name || mk;
      return `<div class="mf"><label style="text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink)">${esc(marketName)}</label>
        ${EXPANSION_CHECKLIST[mk].map(item => {
          const id = mk + '_' + item.k;
          const checked = !!S.expansion.checklist[id];
          return `<label class="ck" title="${esc(item.why)}">
            <input type="checkbox" data-expck="${id}"${checked?' checked':''}${isAdmin()?'':' disabled'}>
            <span>${esc(item.label)}</span></label>${item.url
              ? ` <a href="${esc(item.url)}" target="_blank" rel="noopener" class="k-handle-link" style="font-size:11px">Source</a>`
              : ''}`;
        }).join('')}
      </div>`;
    }).join('');
    qsa('[data-expck]').forEach(c => c.addEventListener('change', () => {
      S.expansion.checklist[c.dataset.expck] = c.checked; save();
    }));
  }

  const distBox = el('expDistributors');
  if(distBox){
    const rows = S.expansion.distributors;
    distBox.innerHTML = rows.length
      ? `<div class="tb-wrap"><table class="tb">
          <thead><tr><th>Name</th><th>Market</th><th>Contact</th><th>Status</th><th>Notes</th><th></th></tr></thead>
          <tbody>${rows.map((d,i) => `<tr>
            <td><input class="audit-in" data-dist="${i}|name" value="${esc(d.name||'')}" placeholder="Company or agent name"${isAdmin()?'':' disabled'}></td>
            <td><select class="audit-in" data-dist="${i}|market"${isAdmin()?'':' disabled'}>
              ${EXPANSION_MARKETS.map(m=>`<option value="${m.k}"${d.market===m.k?' selected':''}>${esc(m.name)}</option>`).join('')}
            </select></td>
            <td><input class="audit-in" data-dist="${i}|contact" value="${esc(d.contact||'')}" placeholder="email or phone"${isAdmin()?'':' disabled'}></td>
            <td><select class="audit-in" data-dist="${i}|status"${isAdmin()?'':' disabled'}>
              ${['Researching','Contacted','In discussion','Agreed'].map(s=>`<option${d.status===s?' selected':''}>${s}</option>`).join('')}
            </select></td>
            <td><input class="audit-in" data-dist="${i}|notes" value="${esc(d.notes||'')}"${isAdmin()?'':' disabled'}></td>
            <td>${isAdmin()?`<button class="btn-line sm danger" data-distdel="${i}">Remove</button>`:''}</td>
          </tr>`).join('')}</tbody></table></div>`
      : `<p class="empty">No candidates yet — add one once your team identifies a real local agent or distributor.</p>`;
    qsa('[data-dist]').forEach(inp => inp.addEventListener('change', () => {
      const [i, field] = inp.dataset.dist.split('|');
      S.expansion.distributors[+i][field] = inp.value; save();
    }));
    qsa('[data-distdel]').forEach(b => b.addEventListener('click', () => {
      S.expansion.distributors.splice(+b.dataset.distdel, 1);
      save(); renderExpansion();
    }));
  }

  const addBtn = el('expAddDist');
  if(addBtn){
    addBtn.hidden = !isAdmin();
    addBtn.onclick = () => {
      S.expansion.distributors.push({ name:'', market:'malaysia', contact:'', status:'Researching', notes:'' });
      save(); renderExpansion();
    };
  }

  const leadsBox = el('expLeads');
  if(leadsBox){
    leadsBox.innerHTML = `<div class="promo-grid">${Object.keys(EXPANSION_LEADS).map(mk => {
      const marketName = (EXPANSION_MARKETS.find(m=>m.k===mk)||{}).name || mk;
      return EXPANSION_LEADS[mk].map(lead => `
        <div class="promo-card">
          <span>${esc(marketName)}</span><b>${esc(lead.name)}</b>
          <p>${esc(lead.role)}</p>
          <p style="font-size:11px;color:var(--faint);margin-top:6px">
            <a href="${esc(lead.url)}" target="_blank" rel="noopener" class="k-handle-link">Source</a></p>
        </div>`).join('');
    }).join('')}</div>`;
  }

  const fitBox = el('expSkuFit');
  if(fitBox){
    fitBox.innerHTML = EXPANSION_MARKETS.map(m => `
      <div class="mf"><label>${esc(m.name)}</label>
        <textarea data-expfit="${m.k}" rows="3"${isAdmin()?'':' readonly'}>${esc(S.expansion.skuFit[m.k]||'')}</textarea></div>`).join('');
    qsa('[data-expfit]').forEach(t => t.addEventListener('input', () => {
      S.expansion.skuFit[t.dataset.expfit] = t.value; save();
    }));
  }
}

function renderAlloc(){
  const B = computeBudget();
  const i = +el('allocMonth').value || 0;
  const b = B[i];
  const rows = [];
  Object.keys(ALLOC).forEach(ck => {
    const spend = b.ch[ck] || 0;
    if(spend <= 0) return;
    ALLOC[ck].forEach(a => rows.push({ ch:ck, ...a, amt: spend * a.w }));
  });
  const tot = rows.reduce((a,r)=>a+r.amt,0);
  el('allocTot').innerHTML = `Month total <b>${cur(tot)}</b>`;
  el('allocTable').innerHTML = rows.length
    ? `<thead><tr><th>Channel</th><th>Product or bundle</th><th>Format</th>
        <th>Success measure</th><th class="n">Budget</th><th class="n">Share</th></tr></thead><tbody>` +
      rows.map(r => `<tr>
        <td><span class="pill p-n" style="background:${CHAN_META[r.ch].color}18;color:${CHAN_META[r.ch].color}">${CHAN_META[r.ch].name}</span></td>
        <td><b>${esc(r.label)}</b></td><td>${esc(r.fmt)}</td>
        <td style="color:var(--mute)">${esc(r.kpi)}</td>
        <td class="n"><b>${cur(r.amt)}</b></td>
        <td class="n" style="color:var(--faint)">${tot?Math.round(r.amt/tot*100):0}%</td></tr>`).join('') +
      `</tbody>`
    : `<tbody><tr><td colspan="6" class="empty">No paid media this month — the budget is committed to creator gifting.</td></tr></tbody>`;
}

/* ═══════════ KOL — see kol.js for roster, fit scoring, scheduling ═══════════ */

/* prompt generator — verified data only */
function buildPrompt(handle, platform, tool){
  return `You are helping verify a creator profile for a brand partnership. Accuracy matters more than completeness.

CREATOR: ${handle}
PLATFORM: ${platform}
MARKET: ${S.settings.market}

Search the web and report ONLY figures you can confirm from a primary or reputable source that you can name. Do not estimate. Do not infer. Do not fill a gap with a typical or average value.

Report these fields:
1. Full display name and confirmed ${platform} handle
2. Follower count — with the date observed
3. Engagement rate — state how it was calculated and over how many posts
4. Total number of posts or videos published
5. Whether they have a shop or affiliate storefront, and any publicly disclosed GMV or sales volume
6. Audience breakdown — gender split, top age bands, top locations
7. Public contact route — business email in bio, management agency, or whether DMs are open
8. Recent brand partnerships in skincare or beauty, with dates
9. Whether the account shows signs of inauthentic following

FORMAT
Return a table with three columns: Field, Value, Source URL.

RULES — these override any instinct to be helpful:
· If you cannot verify a field, write exactly "NOT VERIFIED" in the Value column and leave Source blank.
· Never present an estimate, a range, or a typical figure as if it were observed.
· Every number must carry a source URL that a person can open and check.
· If you cannot find the account at all, say so plainly and stop. Do not offer a similar account instead.
· Do not generate sample, placeholder or illustrative data under any circumstances.

If most fields come back NOT VERIFIED, say so directly so I know to check the creator's storefront and marketplace affiliate pages manually instead.`;
}

el('genPrompt').addEventListener('click', () => {
  const h = el('resHandle').value.trim();
  if(!h){ toast('Enter a handle first'); el('resHandle').focus(); return; }
  const handle = h.startsWith('@') ? h : '@' + h;
  const tool = el('resTool').value;
  el('poTool').textContent = tool;
  el('promptText').textContent = buildPrompt(handle, el('resPlatform').value, tool);
  el('promptOut').hidden = false;
  el('promptOut').scrollIntoView({behavior:'smooth', block:'nearest'});
});
el('copyPrompt').addEventListener('click', () => {
  navigator.clipboard.writeText(el('promptText').textContent)
    .then(()=>toast('Prompt copied — paste it into the tool'))
    .catch(()=>toast('Select the text and copy manually'));
});

/* ═══════════ CONTENT MODULE ═══════════
   USP vs competitor gap read, and a copy-paste prompt builder for
   a locked brand-ambassador persona. No API keys live in this static
   site, so this only ever produces text for the user to paste
   themselves into Higgsfield/MaxFusion/Gemini/etc.               */
function contentGaps(){
  const compRows = (S.compIntel && S.compIntel.length) ? S.compIntel : COMPETITOR_INTEL;
  const allMsg = compRows.map(r => (r.keyMessage||'').toLowerCase()).join(' | ');
  const coverageTest = {
    Emotional:     /hydrat|glow|soft|calm/,
    Educational:   /technolog|mechanism|clinical|science|ingredient/,
    Credibility:   /proven|clinical|dermatolog|study|patent/,
    Differentiation:/patent|delivery|absorption|formula/
  };
  return DNUVO_MESSAGE_STACK.map(m => {
    const test = coverageTest[m.lane];
    const covered = test ? test.test(allMsg) : false;
    return { lane:m.lane, text:m.text, covered,
      opportunity: covered
        ? `Competitors already lean on similar ${m.lane.toLowerCase()} language — differentiate with specificity, not repetition.`
        : `Competitors are not leaning on ${m.lane.toLowerCase()} messaging — an open lane for d.nuvo to own.` };
  });
}

function pickGapFor(persona){
  const gaps = contentGaps();
  return gaps.find(g => persona.contentFocus.includes(g.lane) && !g.covered)
    || gaps.find(g => persona.contentFocus.includes(g.lane))
    || gaps[0];
}

function buildContentPrompt(personaId, formatKey){
  const persona = BRAND_PERSONAS.find(p => p.id === personaId) || BRAND_PERSONAS[0];
  const format = CONTENT_FORMATS.find(f => f.k === formatKey) || CONTENT_FORMATS[0];
  const matched = pickGapFor(persona);
  const palette = persona.palette.map(c => `${c.name} (${c.hex})`).join(', ');

  return `PERSONA — lock this across every generation so the character stays consistent. This is a real, pre-defined brand ambassador, not a generic model:
Name: ${persona.name} — "${persona.archetype}"
Age / hometown: ${persona.age}, ${persona.hometown}
Background: ${persona.discipline}
Look: ${persona.look}
Aesthetic: ${persona.aesthetic}
Color palette for this character's scenes: ${palette}
Backstory (for authenticity in dialogue/captions, not to state outright): ${persona.backstory}
Skin condition — keep this real and visible, never airbrushed to perfection: ${persona.skinCondition}
Tone of voice: ${persona.tone}
Native platforms: ${persona.platforms}
Recurring hashtags: ${persona.hashtags.join(' ')}
Signature line: "${persona.tagline}"

CONTENT BRIEF
Format: ${format.name}
E-E-A-T pillar this piece serves: ${persona.eeatPillar}
Message lane: ${matched.lane} — "${matched.text}"
Opportunity: ${matched.opportunity}

GENERATION STEPS — paste into Higgsfield, MaxFusion, Gemini, or your image/video tool of choice:
1. Establish ${persona.name}'s look exactly as described above — same face, styling, palette and setting every time so she is recognizable across posts.
2. Set the scene for a ${format.name.toLowerCase()}, in an environment true to her real life (per her background above), consistent with d.nuvo's masstige positioning.
3. Show her real skin condition honestly — this is what makes her credible, not something to smooth away.
4. Have ${persona.name} deliver the message lane in her own voice — ${persona.tone.toLowerCase()}
5. Overlay or voice the core line: "${matched.text}", closing on her signature line if the format allows.
6. End on a clear, single call to action appropriate to the format (swipe, watch to the end, or shop link).

RULES
- Do not invent clinical claims or numbers beyond what is in the approved messaging stack.
- Keep ${persona.name}'s appearance, skin condition, tone and backstory identical across every prompt run — she is a recurring character, not a new face each time.
- If the tool cannot follow the persona description precisely, note the deviation rather than accepting a different-looking result silently.`;
}

function renderContentModule(){
  const cards = el('personaCards');
  if(cards){
    cards.innerHTML = `<div class="pf-grid">${BRAND_PERSONAS.map(p => `
      <div class="pf-card">
        <div class="pf-h"><b>${esc(p.name)}</b><span class="pill p-v">${esc(p.archetype)}</span></div>
        <div class="pf-meta">${esc(p.age)} · ${esc(p.hometown)} · ${esc(p.discipline)}</div>
        <p><b>Look:</b> ${esc(p.look)}</p>
        <p><b>Skin condition:</b> ${esc(p.skinCondition)}</p>
        <p><b>Tone:</b> ${esc(p.tone)}</p>
        <p><b>Platforms:</b> ${esc(p.platforms)}</p>
        <p><b>E-E-A-T:</b> ${esc(p.eeatPillar)} — "${esc(p.tagline)}"</p>
        <p class="sub">${p.hashtags.map(h=>esc(h)).join(' ')}</p>
      </div>`).join('')}</div>`;
  }

  const gapsBox = el('contentGaps');
  if(gapsBox){
    gapsBox.innerHTML = `<div class="bp-tactics">${contentGaps().map(g => `
      <div class="bp-t"><b>${esc(g.lane)}</b><p>"${esc(g.text)}" — ${esc(g.opportunity)}</p></div>`).join('')}</div>`;
  }

  const personaSel = el('cpPersona');
  if(personaSel && !personaSel.options.length){
    personaSel.innerHTML = BRAND_PERSONAS.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(p.archetype)}</option>`).join('');
  }
  const formatSel = el('cpFormat');
  if(formatSel && !formatSel.options.length){
    formatSel.innerHTML = CONTENT_FORMATS.map(f => `<option value="${f.k}">${esc(f.name)}</option>`).join('');
  }
}

const buildContentPromptBtn = el('buildContentPromptBtn');
if(buildContentPromptBtn) buildContentPromptBtn.addEventListener('click', () => {
  const txt = buildContentPrompt(el('cpPersona').value, el('cpFormat').value);
  el('contentPromptText').textContent = txt;
  el('contentPromptOut').hidden = false;
  el('contentPromptOut').scrollIntoView({behavior:'smooth', block:'nearest'});
});
const copyContentPromptBtn = el('copyContentPrompt');
if(copyContentPromptBtn) copyContentPromptBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(el('contentPromptText').textContent)
    .then(()=>toast('Prompt copied — paste it into your tool'))
    .catch(()=>toast('Select the text and copy manually'));
});

/* Outbound-only tool links — no API keys ever touch this static site.
   Copies the current prompt, then opens the tool so the user pastes it
   themselves. If a tool's URL hasn't been set yet, ask once and save it. */
function openAiTool(key, label, promptText){
  navigator.clipboard.writeText(promptText).catch(()=>{});
  S.settings.aiToolLinks = S.settings.aiToolLinks || {};
  const known = S.settings.aiToolLinks[key];
  if(known){
    window.open(known, '_blank', 'noopener');
    toast('Prompt copied — paste it into ' + label);
    return;
  }
  modal(`${label} URL`, `<div class="mf"><label>${esc(label)} web address</label>
    <input id="aiToolUrl" placeholder="https://…">
    <p class="fh">Saved once so the button opens it directly next time.</p></div>`,
    [['Cancel','x'],['Save and open','ok']], a => {
      if(a !== 'ok') return true;
      const u = (el('aiToolUrl').value || '').trim();
      if(!u) return false;
      S.settings.aiToolLinks[key] = u;
      save();
      window.open(u, '_blank', 'noopener');
      toast('Prompt copied — paste it into ' + label);
      return true;
    });
}
[['openHiggsfield','higgsfield','Higgsfield'],['openMaxfusion','maxfusion','MaxFusion'],['openGemini','gemini','Gemini']]
  .forEach(([id,key,label]) => {
    const b = el(id);
    if(b) b.addEventListener('click', () => openAiTool(key, label, el('contentPromptText').textContent));
  });

/* Batch weekly prompt set — round-robins personas × formats so a week's
   worth of content spans multiple personas and E-E-A-T pillars rather
   than repeating one. Still text-only output. */
function buildWeeklyPromptSet(count){
  const n = Math.max(2, Math.min(15, count|0 || 6));
  const out = [];
  for(let i=0; i<n; i++){
    const persona = BRAND_PERSONAS[i % BRAND_PERSONAS.length];
    const format = CONTENT_FORMATS[i % CONTENT_FORMATS.length];
    out.push({ persona, format, prompt: buildContentPrompt(persona.id, format.k) });
  }
  return out;
}

const buildWeekSetBtn = el('buildWeekSetBtn');
if(buildWeekSetBtn) buildWeekSetBtn.addEventListener('click', () => {
  const count = num(el('cpWeekCount').value) || 6;
  const set = buildWeeklyPromptSet(count);
  const box = el('weekPromptSet');
  box.innerHTML = `<div class="ai-tool-row" style="border:none;padding:11px 0">
      <button class="btn-line sm" id="copyWeekSet">Copy all</button>
      <button class="btn-line sm" id="downloadWeekSet">Download as text file</button>
    </div>` +
    set.map((s,i) => `<div class="week-prompt">
      <div class="wp-h"><b>${i+1}. ${esc(s.persona.name)} — ${esc(s.format.name)}</b><span class="pill p-n">${esc(s.persona.eeatPillar)}</span></div>
      <pre>${esc(s.prompt)}</pre>
    </div>`).join('');
  box.dataset.setText = set.map((s,i) => `#${i+1} — ${s.persona.name} — ${s.format.name}\n\n${s.prompt}`).join('\n\n' + '─'.repeat(40) + '\n\n');
  const cp = el('copyWeekSet');
  if(cp) cp.addEventListener('click', () => {
    navigator.clipboard.writeText(box.dataset.setText || '')
      .then(()=>toast('Whole set copied'))
      .catch(()=>toast('Select the text and copy manually'));
  });
  const dl2 = el('downloadWeekSet');
  if(dl2) dl2.addEventListener('click', () => {
    if(typeof dl !== 'function'){ toast('Download is not available right now'); return; }
    dl('dnuvo-content-week-' + (typeof stamp === 'function' ? stamp() : Date.now()) + '.txt', box.dataset.setText || '', 'text/plain;charset=utf-8');
  });
  box.scrollIntoView({behavior:'smooth', block:'nearest'});
});

el('addKol').addEventListener('click', () => kolForm(-1));
const goContentBtn = el('goContentModule');
if(goContentBtn) goContentBtn.addEventListener('click', () => go('content'));
el('apifyBtn').addEventListener('click', () => {
  modal('Paste scrape result', `<div class="mf"><label>Profile JSON</label>
    <textarea id="apJson" rows="9" placeholder='{"handle":"@example","followers":12400,...}'></textarea>
    <p class="fh">Paste the JSON returned by the scraper. Fields that are absent stay empty — nothing is inferred.</p></div>`,
    [['Cancel','x'],['Fill form','ok']], a => {
      if(a!=='ok') return true;
      try{
        const d = JSON.parse(el('apJson').value);
        kolForm(-1, {
          handle:   d.handle || d.username || '',
          name:     d.fullName || d.name || '',
          platform: d.platform || 'TikTok',
          followers:d.followers || d.followersCount || '',
          er:       d.engagementRate || '',
          posts:    d.posts || d.videosCount || '',
          gmv:      d.gmv || '',
          audience: d.audience || '',
          contact:  d.email || d.contact || ''
        });
        return true;
      }catch(e){ toast('That is not valid JSON'); return false; }
    });
});

const kolTplBtn = el('kolTpl');
if(kolTplBtn) kolTplBtn.addEventListener('click', () => {
  const rows = [
    ['type','handle','platform','name','tier','followers','audience','contact','contactMethod','source','sourceAgency',
     'er','posts','rate','avgViews','avgGmv','gpm','retention','fee','commission','paymentTerms','proofLink','adCode','notes','stage'],
    ['ugc','@creator_handle','TikTok','Creator Name','Nano','','','','','','','','','','','','','','','','','','','',''],
    ['live','@live_handle','TikTok','Live Seller','Micro','','','','','','','','','','12000','6000','','6m 20s','200','','','','','','']
  ];
  if(typeof toCSV === 'function' && typeof dl === 'function'){
    dl('dnuvo-kol-import-template-' + stamp() + '.csv', toCSV(rows), 'text/csv;charset=utf-8');
    toast('KOL template downloaded');
  }
});

const kolImportBtn = el('kolImport');
const kolImportFile = el('kolImportFile');
if(kolImportBtn && kolImportFile){
  kolImportBtn.addEventListener('click', () => kolImportFile.click());
  kolImportFile.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = () => {
      if(typeof parseCsvObjects !== 'function'){ toast('CSV parser not available'); return; }
      const rowsIn = parseCsvObjects(String(r.result || ''));
      // Keyed on type+handle, not handle alone — the same person can legitimately
      // have both a UGC and a Livestream record, since this app tracks those as
      // two separate rosters evaluated on different things.
      const existing = new Set(S.kols.map(k => (k.type||'ugc') + '|' + (k.handle||'').toLowerCase()));
      let added = 0, skipped = 0;
      rowsIn.forEach(x => {
        if(!x.handle) return;
        const handle = x.handle.startsWith('@') ? x.handle : ('@' + x.handle);
        const type = (x.type === 'live' ? 'live' : 'ugc');
        const key = type + '|' + handle.toLowerCase();
        if(existing.has(key)){ skipped++; return; }
        const stage = KOL_PIPE.find(s => s.k === (x.stage||'').trim()) ? x.stage.trim() : 'sourced';
        const commission = COMMISSION_OPTIONS.includes((x.commission||'').trim()) ? x.commission.trim() : '';
        S.kols.push({
          id: 'K'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
          type, handle, platform: x.platform || 'TikTok',
          name: x.name || '', tier: x.tier || 'Nano',
          followers: x.followers || '', audience: x.audience || '', contact: x.contact || '',
          contactMethod: CONTACT_METHODS.includes((x.contactmethod||'').trim()) ? x.contactmethod.trim() : '',
          source: x.source || '', sourceAgency: x.sourceagency || '',
          er: x.er || '', posts: x.posts || '', rate: x.rate || '',
          avgViews: x.avgviews || '', avgGmv: x.avggmv || '', gpm: x.gpm || '', retention: x.retention || '', fee: x.fee || '',
          commission, paymentTerms: x.paymentterms || '', proofLink: x.prooflink || '', adCode: x.adcode || '',
          notes: x.notes || '', stage, fit: {}
        });
        existing.add(key);
        added++;
      });
      if(added){
        save(); if(typeof renderKol === 'function') renderKol(); renderOverview();
        toast(added + ' creators imported' + (skipped ? ', ' + skipped + ' skipped (already in roster)' : ''));
      }
      else toast(skipped ? 'All ' + skipped + ' rows were already in the roster' : 'No valid creator rows found');
    };
    r.readAsText(f);
    e.target.value = '';
  });
}

const kolAiPickBtn = el('kolAiPick');
if(kolAiPickBtn) kolAiPickBtn.addEventListener('click', () => {
  const list = (S.kols || []).map(k => {
    const gpm = (typeof computeGpm === 'function') ? computeGpm(k) : 0;
    const score = (typeof fitScore === 'function') ? fitScore(k) : 0;
    const rank = Math.round(gpm / 100) + score;
    return { rank, gpm, score, k };
  }).sort((a,b) => b.rank - a.rank).slice(0, 8);
  modal('AI shortlist (best fit first)', `<div class="tb-wrap"><table class="tb">
    <thead><tr><th>Creator</th><th>Type</th><th class="n">GPM</th><th class="n">Fit</th><th class="n">Rank</th></tr></thead>
    <tbody>${list.map(x => `<tr><td><b>${esc(x.k.handle || '')}</b></td><td>${esc(x.k.type || 'ugc')}</td><td class="n">${x.gpm ? ('$' + Math.round(x.gpm)) : '—'}</td><td class="n">${x.score}/10</td><td class="n">${x.rank}</td></tr>`).join('')}</tbody>
  </table></div><p class="fh">Use as recommendation only. Keep verified-data standards before activation.</p>`, [['Close','x']], () => true);
});


/* ═══════════ EVENTS / CALENDAR ═══════════ */
function renderEvents(){
  const pa = el('promoArchitecture');
  if(pa){
    pa.innerHTML = `<div class="promo-grid">${PROMO_ARCHITECTURE.map(p =>
      `<div class="promo-card"><span>${esc(p.title)}</span><b>${esc(p.value)}</b><p>${esc(p.note)}</p></div>`
    ).join('')}</div>`;
  }

  const rw = el('retailWindowTable');
  if(rw){
    rw.innerHTML = `<thead><tr><th>Month</th><th>Phase</th><th>Focus</th><th>Channel</th><th>Mechanic</th><th>Goal</th></tr></thead><tbody>` +
      RETAIL_EVENT_WINDOWS.map(r => `<tr>
        <td><b>${esc(r.month)}</b></td>
        <td>${esc(r.phase)}</td>
        <td>${esc(r.focus)}</td>
        <td>${esc(r.channel)}</td>
        <td>${esc(r.mechanic)}</td>
        <td>${esc(r.goal)}</td>
      </tr>`).join('') + `</tbody>`;
  }

  S.eventStatus = S.eventStatus || {};
  const evStatusOpts = ['Not started','Planned','Done'];
  el('eventTable').innerHTML = `<thead><tr><th>Activity</th><th>When</th><th class="n">Budget</th>
      <th>Purpose</th><th>How it runs</th><th>Owner</th><th>Status</th><th>Actual date</th></tr></thead><tbody>` +
    EVENTS.map((e,i) => {
      const st = S.eventStatus[i] || {};
      return `<tr><td><b>${esc(e.name)}</b></td><td class="n">${esc(e.when)}</td>
      <td class="n">${esc(e.budget)}</td><td>${esc(e.goal)}</td>
      <td style="max-width:340px">${esc(e.how)}</td><td>${esc(e.owner)}</td>
      <td><select class="ev-status" data-evi="${i}">${evStatusOpts.map(o=>
        `<option${(st.status||'Not started')===o?' selected':''}>${o}</option>`).join('')}</select></td>
      <td><input type="date" class="ev-date" data-evi="${i}" value="${esc(st.date||'')}"></td></tr>`;
    }).join('') + `</tbody>`;
  qsa('.ev-status').forEach(s => s.addEventListener('change', () => {
    const i = s.dataset.evi;
    S.eventStatus[i] = S.eventStatus[i] || {};
    S.eventStatus[i].status = s.value;
    save();
  }));
  qsa('.ev-date').forEach(d => d.addEventListener('change', () => {
    const i = d.dataset.evi;
    S.eventStatus[i] = S.eventStatus[i] || {};
    S.eventStatus[i].date = d.value;
    save();
  }));
}

function renderCalendar(){
  const B = computeBudget();

  const pc = el('promoCalendar');
  if(pc){
    const active = PROMO_PERIODS
      .map(p => ({ p, cfg: (S.settings.promoPeriods||{})[p.k] }))
      .filter(x => x.cfg && x.cfg.active);
    pc.innerHTML = active.length
      ? `<div class="tb-wrap"><table class="tb">
          <thead><tr><th>Period</th><th>Month</th><th>Mechanic</th></tr></thead>
          <tbody>${active.map(({p,cfg}) => {
            const m = MONTHS.find(x=>x.k===cfg.month);
            return `<tr><td><b>${esc(p.name)}</b></td><td>${esc(cfg.month)}${m?' · '+esc(m.label):''}</td><td>${esc(p.mechanicNote)}</td></tr>`;
          }).join('')}</tbody>
        </table></div>`
      : `<p class="empty">No promo periods marked active yet — set them in Campaign setup, at the top of the Strategy view.</p>`;
  }

  el('calTable').innerHTML = `<thead><tr><th>Month</th><th>Media</th><th>Creators</th>
      <th>Activity</th><th>Promotion</th><th class="n">Units</th><th class="n">Budget</th></tr></thead><tbody>` +
    MONTHS.map((m,i) => `<tr><td><b>${esc(m.label)}</b></td><td>${esc(m.media)}</td>
      <td>${esc(m.kolWork)}</td><td>${esc(m.events)}</td><td>${esc(m.promo)}</td>
      <td class="n">${B[i].units}</td><td class="n">${cur(B[i].budget)}</td></tr>`).join('') +
    `<tr class="tot"><td colspan="5">Total</td><td class="n">${B.reduce((a,b)=>a+b.units,0).toLocaleString()}</td>
      <td class="n">${cur(B.reduce((a,b)=>a+b.budget,0))}</td></tr></tbody>`;

  el('weekBox').innerHTML = WEEKS.map((w,wi) =>
    `<div class="wk"><div class="wk-h"><b>${esc(w.n)} — ${esc(w.t)}</b><span>${esc(w.owner)}</span></div>
      ${w.items.map((it,ii) => {
        const id = `w${wi}_${ii}`;
        return `<label class="ck"><input type="checkbox" data-ck="${id}"${S.checks[id]?' checked':''}>
          <span>${esc(it)}</span></label>`;
      }).join('')}</div>`).join('');
  qsa('[data-ck]').forEach(c => c.addEventListener('change', () => {
    S.checks[c.dataset.ck] = c.checked; save();
  }));
}

/* ═══════════ APPROVALS ═══════════ */
function openRequest(area, field, from, to, why){
  modal('Request a change', `
    <div class="mf"><label>Area</label><input id="rqArea" value="${esc(area)}" readonly></div>
    <div class="mf"><label>What should change</label><input id="rqField" value="${esc(field)}"></div>
    <div class="mf2">
      <div class="mf"><label>Current</label><input id="rqFrom" value="${esc(from)}"></div>
      <div class="mf"><label>Proposed</label><input id="rqTo" value="${esc(to)}"></div></div>
    <div class="mf"><label>Why</label><textarea id="rqWhy" rows="4">${esc(why)}</textarea>
      <p class="fh">An administrator reviews this. Give them enough to decide without asking you.</p></div>`,
    [['Cancel','x'],['Send request','ok']], a => {
      if(a!=='ok') return true;
      S.requests.push({
        id: Date.now(), area: el('rqArea').value, field: el('rqField').value,
        from: el('rqFrom').value, to: el('rqTo').value, why: el('rqWhy').value,
        status:'pending', at:new Date().toISOString()
      });
      save(); renderApprovals(); renderOverview();
      toast('Request sent for approval');
      return true;
    });
}

function renderApprovals(){
  const pending = S.requests.filter(r=>r.status==='pending');
  const badge = el('reqBadge');
  badge.hidden = !pending.length; badge.textContent = pending.length;

  const listHtml = S.requests.length
    ? S.requests.slice().reverse().map(r => {
        const d = new Date(r.at);
        const stat = r.status==='pending'
          ? `<span class="pill p-a">Pending</span>`
          : r.status==='approved' ? `<span class="pill p-g">Approved</span>`
          : `<span class="pill p-r">Declined</span>`;
        return `<div class="req">
          <div class="req-h">${stat}<b>${esc(r.area)}</b>
            <span style="color:var(--mute);font-size:12.5px">${esc(r.field)}</span>
            <span class="when">${d.toLocaleDateString()}</span></div>
          ${(r.from||r.to)?`<div class="req-d">
            <span class="from">${esc(r.from||'—')}</span><span>→</span>
            <span class="to">${esc(r.to||'—')}</span></div>`:''}
          ${r.why?`<div class="req-why">${esc(r.why)}</div>`:''}
          ${r.status==='pending'?`<div class="req-a">
            <button class="btn-ok" data-ap="${r.id}">Approve</button>
            <button class="btn-no" data-dc="${r.id}">Decline</button></div>`:''}
        </div>`;
      }).join('')
    : `<p class="empty">No requests. When a team member proposes a change, it lands here.</p>`;

  el('reqList').innerHTML = `<div class="req-tools">
      <button class="btn-line sm" id="reqDlAll">Download all requests</button>
      <button class="btn-line sm" id="reqDlOpen">Download open requests</button>
    </div>${listHtml}`;

  const buildReqRows = onlyOpen => {
    const rows = [['Date','Status','Area','Field','From','To','Reason']];
    (onlyOpen ? pending : S.requests).forEach(r => rows.push([
      new Date(r.at).toLocaleDateString(), r.status, r.area, r.field, r.from, r.to, r.why
    ]));
    return rows;
  };

  const downloadReqCsv = onlyOpen => {
    if(typeof toCSV !== 'function' || typeof dl !== 'function'){
      toast('Download is not ready yet');
      return;
    }
    const rows = buildReqRows(onlyOpen);
    const suffix = onlyOpen ? 'open-requests' : 'all-requests';
    dl(`dnuvo-${suffix}-${stamp()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    toast(onlyOpen ? 'Open requests downloaded' : 'All requests downloaded');
  };

  el('reqDlAll').addEventListener('click', () => downloadReqCsv(false));
  el('reqDlOpen').addEventListener('click', () => downloadReqCsv(true));

  qsa('[data-ap]').forEach(b => b.addEventListener('click', () => {
    const r = S.requests.find(x=>x.id==b.dataset.ap); r.status='approved';
    save(); renderApprovals(); toast('Approved — apply the change in the relevant view');
  }));
  qsa('[data-dc]').forEach(b => b.addEventListener('click', () => {
    const r = S.requests.find(x=>x.id==b.dataset.dc); r.status='declined';
    save(); renderApprovals(); toast('Declined');
  }));
}

/* ═══════════ REPORTING ═══════════ */
function renderReport(){
  const B = computeBudget();
  el('scoreTable').innerHTML = `<thead><tr><th>Month</th><th class="n">Units plan</th><th class="n">Units actual</th>
      <th class="n">Revenue plan</th><th class="n">Revenue actual</th><th class="n">Return</th>
      <th class="n">Reviews</th><th class="n">Rating</th><th class="n">Audience pool</th><th class="n">Buyers</th></tr></thead><tbody>` +
    B.map(b => {
      const a = S.actuals[b.k] || {};
      const f = k => `<span class="ed" contenteditable="true" data-act="${b.k}" data-f="${k}">${esc(a[k]||'')}</span>`;
      return `<tr><td><b>${b.label}</b></td><td class="n">${b.units}</td><td class="n">${f('units')}</td>
        <td class="n">${cur(b.rev)}</td><td class="n">${f('rev')}</td>
        <td class="n">${f('roas')}</td><td class="n">${f('reviews')}</td><td class="n">${f('rating')}</td>
        <td class="n">${f('pool')}</td><td class="n">${f('buyers')}</td></tr>`;
    }).join('') + `</tbody>`;
  qsa('[data-act]').forEach(c => c.addEventListener('blur', () => {
    const k = c.dataset.act, field = c.dataset.f;
    const raw = c.textContent.trim();
    if(!saveActualField(k, field, raw)){
      toast(`"${raw}" doesn't look like a number — ${field} actual was not saved`);
      c.textContent = (S.actuals[k]||{})[field] || '';
      return;
    }
    renderRail(); renderOverview();
    if(typeof renderMedia === 'function' && budgetTableView === 'month') renderMedia();
  }));

  el('kpiTable').innerHTML = `<thead><tr><th>Metric</th><th>Target</th><th>Where to read it</th>
      <th>If it slips</th></tr></thead><tbody>` +
    METRICS.map(m => `<tr><td><b>${esc(m.name)}</b></td><td class="n">${esc(m.target)}</td>
      <td style="color:var(--mute)">${esc(m.src)}</td><td>${esc(m.action)}</td></tr>`).join('') + `</tbody>`;

  el('notesBox').innerHTML = [
    ['worked','What worked, and what should we do more of'],
    ['failed','What did not work, and what do we stop'],
    ['next','Top three priorities next month'],
    ['stock','Stock remaining per product — flag anything under 50 units']
  ].map(([k,l]) => `<label>${l}</label>
    <textarea data-note="${k}" rows="3">${esc(S.notes[k]||'')}</textarea>`).join('');
  qsa('[data-note]').forEach(t => t.addEventListener('input', () => {
    S.notes[t.dataset.note] = t.value; save();
  }));
}

/* ═══════════ MODAL ═══════════ */
let modalCb = null;
function modal(title, body, btns, cb){
  el('modalTitle').textContent = title;
  el('modalBody').innerHTML = body;
  el('modalFoot').innerHTML = btns.map(([l,a]) =>
    `<button class="${a==='ok'?'btn-solid':a==='del'?'btn-no':'btn-line'}" data-act="${a}">${esc(l)}</button>`).join('');
  modalCb = cb;
  el('modal').hidden = false;
  qsa('#modalFoot [data-act]').forEach(b => b.addEventListener('click', () => {
    if(!modalCb || modalCb(b.dataset.act) !== false) closeModal();
  }));
}
function closeModal(){ el('modal').hidden = true; modalCb = null; }
el('modalX').addEventListener('click', closeModal);
el('modal').addEventListener('click', e => { if(e.target === el('modal')) closeModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !el('modal').hidden) closeModal(); });

/* ═══════════ BACKUP ═══════════ */
el('backupBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(S,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `launch-console-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('Backup downloaded');
});
el('restoreBtn').addEventListener('click', () => el('restoreFile').click());
el('restoreFile').addEventListener('change', e => {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(r.result);
      if(typeof d !== 'object' || !d) throw 0;
      localStorage.setItem(KEY, JSON.stringify(d));
      toast('Backup restored'); setTimeout(()=>location.reload(), 700);
    }catch(err){ toast('That file could not be read'); }
  };
  r.readAsText(f);
});

/* ═══════════ BOOT ═══════════ */
function renderAll(){
  renderRail(); renderOverview(); renderStrategy(); renderPricing();
  renderBrandPulse(); renderMedia(); renderExpansion(); renderContentModule(); renderEvents(); renderCalendar(); renderApprovals(); renderReport(); renderAiStrategy();
  if(typeof renderPersonas === 'function') renderPersonas();
  applyModuleVisibility();
  if(typeof renderProposals === 'function') renderProposals();
  // tables are rebuilt on each render, so re-attach sorting and download menus
  if(typeof refreshSortable === 'function'){ refreshSortable(); injectPanelExports(); }
}
function boot(){
  renderAll(); renderKol(); renderPlaybook(); go('overview');
  if(typeof initConsoleUI === 'function') initConsoleUI();
}

load();
initSiteGate();
initGate();
