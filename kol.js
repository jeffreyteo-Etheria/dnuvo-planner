/* ════════════════════════════════════════════════
   KOL hub
   Two rosters, evaluated differently:
   UGC creators earn reviews. Livestream creators
   earn GMV — and are scored before any fee is set.
   The full roster is visible to the team, and team
   members can add and curate records at any stage —
   but only an administrator can delete one.
   ════════════════════════════════════════════════ */

let kolTab = 'ugc';
let kolStage = 'creators';
let kolViewFilter = 'default'; // 'default' | 'all' | a KOL_PIPE stage key
let kolFilters = { q:'', platform:'', tier:'', creatorClass:'', market:'', dupes:'all' };
let schedView = 'table';
let schedStatusFilter = 'all';
let schedCalMonth = null;
let schedCalFilters = { kol:'', type:'', status:'' };
let schedBoardFilters = { type:'' };
const SCHED_BOARD_TONE = { planned:'p-n', confirmed:'p-v', live:'p-a', done:'p-g' };
function schedBoardOf(e){ return e.board || (e.done ? 'done' : 'planned'); }
/* Cold = never contacted. Warm = in conversation. Confirmed = terms locked
   or booked. Completed = delivered. Declined only shows under "All" — it
   isn't folded into any of the four so a genuinely dead lead can't quietly
   inflate a bucket someone's using to decide who to chase next. */
function warmthOf(k){
  if(k.stage === 'declined') return 'declined';
  const g = KOL_WARMTH.find(w => w.stages.includes(k.stage));
  return g ? g.k : 'cold';
}
/* Most relevant schedule entry for this creator — the nearest thing still
   upcoming, or failing that the most recent thing already done. Powers the
   roster table's Schedule column so a planner doesn't have to cross-reference
   the Post stage separately to see if someone's actually booked. */
function scheduleStatusFor(handle){
  const entries = (S.schedule || []).filter(e => e.kol === handle);
  if(!entries.length) return null;
  const today = new Date().toISOString().slice(0,10);
  const upcoming = entries.filter(e => e.date >= today).sort((a,b) => a.date.localeCompare(b.date));
  const past = entries.filter(e => e.date < today).sort((a,b) => b.date.localeCompare(a.date));
  return upcoming[0] || past[0];
}
function normHandle(h){
  return String(h || '').trim().toLowerCase().replace(/^@+/, '');
}
function inferredCreatorClass(k){
  const raw = [k.creatorClass, k.creatorRemark, k.tier, k.sourceAgency, k.source, k.notes].join(' ').toLowerCase();
  return raw.includes('artiste') || raw.includes('bloomrs') ? 'Artiste' : 'Creator';
}
function duplicateHandleGroups(){
  const groups = new Map();
  (S.kols || []).forEach((k, i) => {
    const h = normHandle(k.handle);
    if(!h) return;
    if(!groups.has(h)) groups.set(h, []);
    groups.get(h).push({ k, i });
  });
  return [...groups.entries()].filter(x => x[1].length > 1);
}
function duplicateInfoFor(k){
  const h = normHandle(k.handle);
  if(!h) return null;
  const matches = (S.kols || []).map((x,i) => ({ k:x, i })).filter(x => normHandle(x.k.handle) === h);
  return matches.length > 1 ? matches : null;
}
function followerTier(k){
  const explicit = String(k.tier || '').toLowerCase();
  if(explicit.includes('mega')) return 'Mega';
  if(explicit.includes('macro')) return 'Macro';
  if(explicit.includes('micro')) return 'Micro';
  if(explicit.includes('nano')) return 'Nano';
  const f = num(k.followers);
  if(f >= 100000) return 'Mega';
  if(f >= 10000) return 'Micro';
  if(f > 0) return 'Nano';
  return '';
}
function verifiedFieldCount(k){
  const keys = k.type === 'live'
    ? ['followers','avgViews','avgGmv','gpm','audience','source','contact']
    : ['followers','er','posts','audience','source','contact','proofLink'];
  return keys.filter(key => String(k[key] || '').trim()).length;
}
function creatorScore(k){
  const fit = fitScore(k);
  const gpm = computeGpm(k);
  const verified = verifiedFieldCount(k);
  let score = Math.min(25, verified * 4);
  score += k.proofLink ? 10 : 0;
  score += k.recentBrandPosts ? 8 : 0;
  if(k.type === 'live'){
    score += fit * 4;
    score += gpm >= 511 ? 25 : gpm >= 300 ? 18 : gpm >= 200 ? 10 : 0;
  } else {
    const tier = followerTier(k);
    score += tier === 'Mega' ? 14 : tier === 'Macro' ? 12 : tier === 'Micro' ? 9 : tier === 'Nano' ? 6 : 0;
    score += num(k.er) >= 3 ? 15 : num(k.er) > 0 ? 8 : 0;
    score += num(k.posts) >= 50 ? 8 : num(k.posts) > 0 ? 4 : 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
function creatorRating(k){
  const s = creatorScore(k);
  if(s >= 75) return { label:'Strong', tone:'p-g', why:'high verified data and fit' };
  if(s >= 55) return { label:'Watch', tone:'p-v', why:'usable, still needs confirmation' };
  if(s >= 35) return { label:'Test', tone:'p-a', why:'limited data; keep terms low' };
  return { label:'Incomplete', tone:'p-r', why:'too many unverified fields' };
}
function creatorRoas(k){
  const gmv = num(k.avgGmv);
  const fee = num(k.fee || k.rate);
  if(gmv && fee) return gmv / fee;
  if(k.type === 'live' && computeGpm(k) && num(k.avgViews) && fee) return (computeGpm(k) * num(k.avgViews) / 1000) / fee;
  return 0;
}
function metricHelp(k){
  const g = computeGpm(k);
  const roas = creatorRoas(k);
  return `Score: verified field completeness + proof + recent brand-post data${k.type==='live'?' + fit ticks + GPM band':' + tier + engagement/posts'}. ` +
    `Rating: Strong 75+, Watch 55+, Test 35+, otherwise Incomplete. ` +
    `GPM: ${g ? 'GMV/views x 1,000' : 'needs avg GMV and avg views'}. ` +
    `ROAS: ${roas ? 'avg GMV divided by agreed fee/rate' : 'needs GMV and fee/rate'}.`;
}
/* Clickable profile link — only for platforms with a reliable public
   @handle URL pattern. Shopee Live and Xiaohongshu don't have one, so
   those stay plain text rather than link to a guess. */
function profileUrl(k){
  const h = (k.handle || '').replace(/^@/, '');
  if(!h) return '';
  const p = String(k.platform || '').trim().toLowerCase();
  if(p === 'tiktok') return 'https://www.tiktok.com/@' + h;
  if(p === 'instagram' || p === 'ig') return 'https://www.instagram.com/' + h;
  if(p === 'youtube') return 'https://www.youtube.com/@' + h;
  return '';
}
/* Purely-numeric-looking handles ("@2,308", "@50k") are the tell-tale sign
   a follower count leaked into the handle column upstream — not a real
   @handle. Caught here so it can't re-enter the roster from manual entry
   after being cleaned out of an import once. */
function looksLikeFollowerCount(handle){
  return /^[\d,.]+[kKmM]?$/.test(String(handle || '').replace(/^@+/, '').trim());
}
const KOL_STAGE_TABS = [
  { k:'creators', name:'Creators', desc:'Source, verify, select' },
  { k:'content',  name:'Content',  desc:'Brief and coordinate' },
  { k:'post',     name:'Post',     desc:'Schedule and deliver' },
  { k:'kpi',      name:'KPI',      desc:'Benchmark vs actual' }
];

/* ── evaluation ── */
function fitScore(k){
  const t = k.fit || {};
  return FIT_FACTORS.filter(f => t[f.k]).length;
}
function criticalMissing(k){
  const t = k.fit || {};
  return FIT_FACTORS.filter(f => f.critical && !t[f.k]);
}
function gpmBand(g){
  const v = num(g);
  if(!g || !v) return GPM_BANDS[GPM_BANDS.length-1];
  return GPM_BANDS.find(b => v >= b.min) || GPM_BANDS[GPM_BANDS.length-1];
}
function computeGpm(k){
  if(k.gpm) return num(k.gpm);
  const gmv = num(k.avgGmv), views = num(k.avgViews);
  return (gmv && views) ? (gmv / views) * 1000 : 0;
}
function scenarioFor(k){
  const score = fitScore(k);
  const crit = criticalMissing(k);
  // A missing critical check caps the deal regardless of score.
  if(crit.length) return Object.assign({}, FEE_SCENARIOS.find(s=>s.k==='s0'),
    { capped:true, capReason: crit.map(c=>c.name).join(' and ') + ' not ticked' });
  const g = computeGpm(k);
  let sc = FEE_SCENARIOS.find(s => score >= s.min && score <= s.max) || FEE_SCENARIOS.find(s=>s.k==='s0');
  // Mega tier additionally requires verified GPM
  if(sc.k === 's3' && g < 511) sc = Object.assign({}, FEE_SCENARIOS.find(s=>s.k==='s2'),
    { capped:true, capReason:'GPM not verified at the elite benchmark' });
  return sc;
}
function isLocked(k){
  const st = KOL_PIPE.find(s => s.k === k.stage);
  return !!(st && st.locked);
}
function canDelete(k){
  return isAdmin();
}
/* A creator can only be marked Complete once there's something to point to
   as proof — either on the record itself (for undated deliverables like a
   UGC post logged without a schedule entry) or on a linked schedule entry
   (for anything with a real date, e.g. a livestream session). */
function hasProof(k){
  if(k.proofLink) return true;
  return (S.schedule || []).some(e => e.kol === k.handle && e.proofLink);
}
/* Payment status on a schedule entry — admin edits, team reads only,
   same split as fee/rate pricing elsewhere in KOL hub. */
function payCell(e){
  const status = e.paidStatus || 'unpaid';
  if(isAdmin()){
    return `<select class="pay-sel" data-pay="${e.id}">
      <option value="unpaid"${status==='unpaid'?' selected':''}>Unpaid</option>
      <option value="deposit"${status==='deposit'?' selected':''}>Deposit paid</option>
      <option value="paid"${status==='paid'?' selected':''}>Paid</option>
    </select>`;
  }
  const label = status === 'paid' ? 'Paid' : status === 'deposit' ? 'Deposit paid' : 'Unpaid';
  const tone = status === 'paid' ? 'p-g' : status === 'deposit' ? 'p-a' : 'p-n';
  return `<span class="pill ${tone}">${label}</span>`;
}

/* Pending pricing proposal flag — mirrors proposals.js's cell() styling,
   since fee/rate are edited via the creator modal, not an inline cell. */
function kolPendingBadge(k, field){
  if(!k || !k.id) return '';
  const p = pendingFor('kol', k.id, field);
  if(!p) return '';
  return isAdmin()
    ? ` <span class="prop-flag" data-prop="${p.id}" title="Proposed by the team — click to decide">
        <span class="pf-dot"></span>${esc(S.settings.cur)}${esc(p.to)}</span>`
    : ` <span class="prop-mine" title="Waiting on an administrator">→ ${esc(S.settings.cur)}${esc(p.to)}</span>`;
}

/* ── render ── */
function renderKol(){
  renderKolStageTabs();
  renderKolTabs();
  renderKolPipe();
  renderWarmthFilter();
  renderKolFilters();
  renderDuplicateWatch();
  renderKolTable();
  renderKolContentAngles();
  renderKolActivation();
  renderKolPayments();
  renderKolBudgetDrilldown();
  renderLongTailPlan();
  renderCrm();
  renderKolActivityTopline();
  renderKolSchedule();
  renderKolScheduleBoard();
  renderKolScheduleCalendar();
  if(typeof refreshSortable === 'function'){ refreshSortable(); injectPanelExports(); }
}

/* Budget → Committed → Spend for the month currently focused in the Media
   plan tab (S.mediaFocus) — sits above the activity list so a planner can
   see KOL spend health without leaving the Post stage to cross-reference
   the KPI stage's budget drilldown or payments panels. */
function renderKolActivityTopline(){
  const box = el('kolActivityTopline'); if(!box) return;
  const i = Number.isInteger(S.mediaFocus) ? S.mediaFocus : 0;
  const d = kolBudgetDrilldown(i);
  const spend = d.entries
    .filter(e => (e.paidStatus||'unpaid') === 'paid')
    .reduce((a,e) => a + (e.feeAgreed||0), 0);
  const c = S.settings.cur;
  box.innerHTML = `<div class="pay-summary">
    <div class="pay-tile"><span>${esc(d.month)} KOL budget</span><b>${esc(c)}${Math.round(d.pool).toLocaleString()}</b></div>
    <div class="pay-tile"><span>Committed</span><b>${esc(c)}${Math.round(d.committed).toLocaleString()}</b></div>
    <div class="pay-tile tot"><span>Spend (paid)</span><b>${esc(c)}${Math.round(spend).toLocaleString()}</b></div>
  </div>`;
}

function renderKolStageTabs(){
  const box = el('kolStageTabs'); if(!box) return;
  box.innerHTML = KOL_STAGE_TABS.map(s => `<button class="kstage-tab ${kolStage===s.k?'on':''}" data-kstage="${s.k}">
    ${esc(s.name)}<span>${esc(s.desc)}</span></button>`).join('');
  qsa('[data-kstage]', box).forEach(b => b.addEventListener('click', () => {
    kolStage = b.dataset.kstage;
    renderKolStageTabs();
  }));
  qsa('.kstage').forEach(sec => sec.classList.toggle('on', sec.dataset.stage === kolStage));
}

function renderKolTabs(){
  const box = el('kolTabs'); if(!box) return;
  box.innerHTML = Object.values(KOL_TYPES).map(t => {
    const n = S.kols.filter(k => (k.type||'ugc') === t.k).length;
    return `<button class="ktab ${kolTab===t.k?'on':''}" data-ktab="${t.k}">
      <b>${esc(t.name)}s</b><span class="kt-n">${n}</span>
      <span class="kt-d">${esc(t.goal)}</span></button>`;
  }).join('');
  qsa('[data-ktab]').forEach(b => b.addEventListener('click', () => {
    kolTab = b.dataset.ktab; renderKol();
  }));

  const t = KOL_TYPES[kolTab];
  const note = el('kolTypeNote');
  if(note) note.innerHTML = `<b>${esc(t.name)}s — ${esc(t.measure)}.</b> ${esc(t.body)}`;
}

function renderKolPipe(){
  const list = S.kols.filter(k => (k.type||'ugc') === kolTab);
  el('pipeBox').innerHTML = KOL_PIPE.map(s => {
    const n = list.filter(k => k.stage === s.k).length;
    return `<button class="pipe-s ${s.locked?'lk':''}${kolViewFilter===s.k?' on':''}" data-stage="${s.k}" title="${esc(s.desc)}">
      <div class="ps-n">${esc(s.name)}${s.locked?' <span class="lk-i">🔒</span>':''}</div>
      <div class="ps-c">${n}</div></button>`;
  }).join('');
  qsa('.pipe-s').forEach(b => b.addEventListener('click', () => {
    kolViewFilter = (kolViewFilter === b.dataset.stage) ? 'default' : b.dataset.stage;
    renderKolPipe(); renderWarmthFilter(); renderKolTable();
  }));
}

/* Dropdown covers the same ground as the stage tiles, plus an explicit
   "All creators" option so the full roster — including cold/warm leads
   the default view hides — is one select away, not just a tile click. */
function renderWarmthFilter(){
  const box = el('warmthFilterBox'); if(!box) return;
  const opts = [
    { k:'default', name:'Confirmed + Completed (default)' },
    { k:'all', name:'All creators — every stage' },
    ...KOL_PIPE.map(s => ({ k:s.k, name:s.name }))
  ];
  box.innerHTML = `<label class="kol-view-filter">View
    <select id="kolViewSel">${opts.map(o =>
      `<option value="${o.k}"${kolViewFilter===o.k?' selected':''}>${esc(o.name)}</option>`).join('')}</select>
  </label><span class="fh">Or click a stage above to jump straight to it.</span>`;
  el('kolViewSel').addEventListener('change', e => {
    kolViewFilter = e.target.value;
    renderKolPipe(); renderKolTable();
  });
}

function renderKolFilters(){
  const box = el('kolFilterBox'); if(!box) return;
  const platforms = [...new Set((S.kols || []).map(k => k.platform).filter(Boolean))].sort();
  const tiers = ['Nano','Micro','Macro','Mega'];
  const classes = ['Creator','Artiste'];
  box.innerHTML = `
    <label class="kol-search">Search
      <input id="kolSearch" value="${esc(kolFilters.q)}" placeholder="@handle, name, notes, brand posts">
    </label>
    <label>Channel
      <select id="kolPlatformFilter"><option value="">All</option>${platforms.map(p => `<option value="${esc(p)}"${kolFilters.platform===p?' selected':''}>${esc(p)}</option>`).join('')}</select>
    </label>
    <label>Tier
      <select id="kolTierFilter"><option value="">All</option>${tiers.map(t => `<option value="${t}"${kolFilters.tier===t?' selected':''}>${t}</option>`).join('')}</select>
    </label>
    <label>Remark
      <select id="kolClassFilter"><option value="">All</option>${classes.map(c => `<option value="${c}"${kolFilters.creatorClass===c?' selected':''}>${c}</option>`).join('')}</select>
    </label>
    <label>Market &gt;50%
      <select id="kolMarketFilter"><option value="">All</option>
        ${AUDIENCE_MARKETS.map(m => `<option value="${m}"${kolFilters.market===m?' selected':''}>${m}</option>`).join('')}
        <option value="_unset"${kolFilters.market==='_unset'?' selected':''}>Not verified</option></select>
    </label>
    <label>Duplicates
      <select id="kolDupFilter">
        <option value="all"${kolFilters.dupes==='all'?' selected':''}>Show all</option>
        <option value="only"${kolFilters.dupes==='only'?' selected':''}>Potential duplicates only</option>
      </select>
    </label>
    <button class="btn-line sm" id="kolFilterClear">Clear</button>`;
  const apply = () => {
    kolFilters.q = el('kolSearch').value.trim();
    kolFilters.platform = el('kolPlatformFilter').value;
    kolFilters.tier = el('kolTierFilter').value;
    kolFilters.creatorClass = el('kolClassFilter').value;
    kolFilters.market = el('kolMarketFilter').value;
    kolFilters.dupes = el('kolDupFilter').value;
    renderKolTable();
  };
  ['kolSearch','kolPlatformFilter','kolTierFilter','kolClassFilter','kolMarketFilter','kolDupFilter'].forEach(id => {
    const node = el(id);
    node.addEventListener(id === 'kolSearch' ? 'input' : 'change', apply);
  });
  el('kolFilterClear').addEventListener('click', () => {
    kolFilters = { q:'', platform:'', tier:'', creatorClass:'', market:'', dupes:'all' };
    renderKolFilters(); renderKolTable();
  });
}

function renderDuplicateWatch(){
  const box = el('kolDuplicateBox'); if(!box) return;
  const groups = duplicateHandleGroups();
  box.hidden = !groups.length;
  if(!groups.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<b>${groups.length} duplicate handle${groups.length===1?'':'s'} found.</b>
    ${groups.map(([h, items]) => `<span class="dup-chip">@${esc(h)} · ${items.map(x => esc((x.k.type||'ugc').toUpperCase())).join(' / ')}</span>`).join('')}
    <span class="fh">Use the duplicate filter, then keep the best verified row and delete the rest.</span>`;
}

function renderKolTable(){
  let list = S.kols.filter(k => (k.type||'ugc') === kolTab);
  if(kolViewFilter === 'all'){
    // no stage filter — full roster
  } else if(kolViewFilter === 'default'){
    list = list.filter(k => { const w = warmthOf(k); return w === 'confirmed' || w === 'completed'; });
  } else {
    list = list.filter(k => k.stage === kolViewFilter);
  }
  const q = kolFilters.q.toLowerCase();
  list = list.filter(k => {
    if(kolFilters.platform && k.platform !== kolFilters.platform) return false;
    if(kolFilters.tier && followerTier(k) !== kolFilters.tier) return false;
    if(kolFilters.creatorClass && inferredCreatorClass(k) !== kolFilters.creatorClass) return false;
    if(kolFilters.market === '_unset' && k.audienceMarket) return false;
    if(kolFilters.market && kolFilters.market !== '_unset' && k.audienceMarket !== kolFilters.market) return false;
    if(kolFilters.dupes === 'only' && !duplicateInfoFor(k)) return false;
    if(q){
      const hay = [k.handle, k.name, k.platform, k.tier, k.followers, k.audience, k.sourceAgency,
        inferredCreatorClass(k), k.notes, k.recentBrandPosts, k.avgViews, k.avgGmv, k.gpm].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  el('kolEmpty').hidden = list.length > 0;
  if(!list.length){
    el('kolTable').innerHTML = '';
    el('kolEmpty').innerHTML = kolTab === 'ugc'
      ? `No UGC creators yet. Research a handle above, then add what you could verify.`
      : `No livestream creators yet. Add one, then run the fit checklist before agreeing any fee.`;
    return;
  }

  const v = x => x ? esc(x) : '<span class="nv">not verified</span>';
  const handleCell = k => {
    const url = profileUrl(k);
    const dup = duplicateInfoFor(k);
    const b = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="k-handle-link">${esc(k.handle)}</a>`
      : esc(k.handle);
    return `<b>${b}</b>${dup?` <span class="dup-badge" title="Same handle appears ${dup.length} times in the roster">duplicate</span>`:''}
      <span class="sub">${esc(k.platform||'')}${k.name?' · '+esc(k.name):''}</span>
      ${k.recentBrandPosts?`<span class="sub">60-day brands: ${esc(k.recentBrandPosts).slice(0,120)}${String(k.recentBrandPosts).length>120?'...':''}</span>`:''}`;
  };
  const contactCell = k => k.contact
    ? `${esc(k.contact)}${k.contactMethod?` <span class="pill p-n">${esc(k.contactMethod)}</span>`:''}`
    : '<span class="nv">not verified</span>';
  const schedCell = k => {
    const e = scheduleStatusFor(k.handle);
    if(!e) return '<span class="nv">none</span>';
    const b = schedBoardOf(e);
    const name = (SCHED_BOARD.find(x=>x.k===b)||{}).name || b;
    return `<span class="pill ${SCHED_BOARD_TONE[b]||'p-n'}">${esc(name)}</span><span class="sub">${esc(e.date)}</span>`;
  };

  const head = kolTab === 'ugc'
    ? `<th>Creator</th><th>Remark</th><th>Tier</th><th class="n">Followers</th><th class="n">Score</th><th>Rating</th>
       <th class="n">Engagement</th><th class="n">Posts</th><th>Contact</th><th class="n">Rate</th><th>Schedule</th><th>Stage</th><th></th>`
    : `<th>Creator</th><th>Remark</th><th class="n">Followers</th><th class="n">Avg views</th><th class="n">GPM</th>
       <th class="n">ROAS</th><th class="n">Score</th><th>Rating</th><th class="n">Fit</th><th>Recommended terms</th><th>Contact</th><th>Stage</th><th></th>`;

  el('kolTable').innerHTML = `<thead><tr>${head}</tr></thead><tbody>` + list.map(k => {
    const i = S.kols.indexOf(k);
    const del = canDelete(k);
    const stageSel = `<select class="k-stage" data-i="${i}">${KOL_PIPE.map(s =>
      `<option value="${s.k}"${k.stage===s.k?' selected':''}>${s.name}</option>`).join('')}</select>`;
    const clsSel = `<select class="k-class" data-class="${i}">
      ${['Creator','Artiste'].map(c => `<option value="${c}"${inferredCreatorClass(k)===c?' selected':''}>${c}</option>`).join('')}</select>`;
    const rating = creatorRating(k);
    const score = creatorScore(k);
    const acts = `<div class="k-acts">
      <button class="btn-line sm" data-edit="${i}">Edit</button>
      <button class="btn-line sm" data-card="${i}">Card</button>
      ${kolTab==='live'?`<button class="btn-line sm" data-fit="${i}">Fit</button>`:''}
      <button class="btn-line sm" data-sched="${i}">Schedule</button>
      <button class="btn-line sm" data-brief="${i}">Brief</button>
      ${del?`<button class="btn-line sm danger" data-del="${i}">Delete</button>`
           :`<span class="lock-t" title="Only an administrator can delete a creator record">🔒</span>`}
    </div>`;

    if(kolTab === 'ugc'){
      return `<tr class="${duplicateInfoFor(k)?'dup-row':''}"><td>${handleCell(k)}</td>
        <td>${clsSel}</td>
        <td><span class="pill p-n">${esc(followerTier(k)||k.tier||'—')}</span></td>
        <td class="n">${v(k.followers)}</td>
        <td class="n" title="${esc(metricHelp(k))}">${score}/100</td>
        <td><span class="pill ${rating.tone}" title="${esc(rating.why)}">${esc(rating.label)}</span></td>
        <td class="n">${k.er?esc(k.er)+'%':'<span class="nv">—</span>'}</td>
        <td class="n">${v(k.posts)}</td>
        <td style="font-size:12px">${contactCell(k)}</td>
        <td class="n">${k.rate?esc(S.settings.cur+k.rate):'<span class="nv">—</span>'}${kolPendingBadge(k,'rate')}</td>
        <td>${schedCell(k)}</td>
        <td>${stageSel}</td><td>${acts}</td></tr>`;
    }

    const g = computeGpm(k);
    const band = gpmBand(g);
    const sc = scenarioFor(k);
    const fit = fitScore(k);
    const roas = creatorRoas(k);
    const hasAgreed = k.commission || k.fee;
    const termsCell = hasAgreed
      ? `<span class="pill p-g">Agreed</span>
         <span class="sub">${k.fee?esc(S.settings.cur+k.fee):'no fixed fee'}${k.commission?' + '+esc(k.commission):''}</span>`
      : `<span class="pill ${sc.tone}">${sc.name}</span>
         <span class="sub">${sc.fee?S.settings.cur+sc.fee.toLocaleString()+' + '+sc.comm+'%':'commission only'}${sc.capped?' · capped':''}</span>`;
    return `<tr class="${duplicateInfoFor(k)?'dup-row':''}"><td>${handleCell(k)}</td>
      <td>${clsSel}</td>
      <td class="n">${v(k.followers)}</td>
      <td class="n">${v(k.avgViews)}</td>
      <td class="n">${g?'$'+Math.round(g).toLocaleString():'<span class="nv">—</span>'}</td>
      <td class="n" title="${esc(metricHelp(k))}">${roas ? roas.toFixed(1)+'×' : '<span class="nv">—</span>'}</td>
      <td class="n" title="${esc(metricHelp(k))}">${score}/100</td>
      <td><span class="pill ${rating.tone}" title="${esc(rating.why)}">${esc(rating.label)}</span></td>
      <td class="n"><span class="fit-s ${fit>=10?'f3':fit>=8?'f2':fit>=5?'f1':'f0'}">${fit}/10</span></td>
      <td>${termsCell}</td>
      <td style="font-size:12px">${contactCell(k)}</td>
      <td>${stageSel}</td><td>${acts}</td></tr>`;
  }).join('') + `</tbody>`;

  qsa('.k-class').forEach(s => s.addEventListener('change', () => {
    const k = S.kols[+s.dataset.class];
    k.creatorClass = s.value;
    k.updatedAt = new Date().toISOString();
    save(); renderKolTable(); renderDuplicateWatch();
  }));
  qsa('.k-stage').forEach(s => s.addEventListener('change', () => {
    const k = S.kols[+s.dataset.i];
    const next = KOL_PIPE.find(p => p.k === s.value);
    if(next.k === 'done' && !hasProof(k)){
      toast('Add a posting/stream link (proof of delivery) before marking this Complete');
      s.value = k.stage; return;
    }
    k.stage = s.value; k.updatedAt = new Date().toISOString(); save(); renderKol(); renderOverview();
  }));
  qsa('[data-edit]').forEach(b => b.addEventListener('click', () => kolForm(+b.dataset.edit)));
  qsa('[data-card]').forEach(b => b.addEventListener('click', () => showCreatorCard(+b.dataset.card)));
  qsa('[data-fit]').forEach(b => b.addEventListener('click', () => fitForm(+b.dataset.fit)));
  qsa('[data-sched]').forEach(b => b.addEventListener('click', () => schedForm(+b.dataset.sched)));
  qsa('[data-brief]').forEach(b => b.addEventListener('click', () => showCreatorBrief(+b.dataset.brief)));
  qsa('[data-del]').forEach(b => b.addEventListener('click', () => delKol(+b.dataset.del)));
  if(typeof wireCells === 'function') wireCells();
}

/* ── add / edit ──
   Full record access for team members at every pipeline stage — only
   pricing/terms fields (rate, fee, commission, payment terms) route through
   the approval gate below when a team member changes an existing value; only
   canDelete() (admin-only) blocks an action outright. */
function kolForm(idx, pre){
  const k = idx >= 0 ? S.kols[idx] : (pre || { type: kolTab });
  const type = k.type || kolTab;
  const T = KOL_TYPES[type];

  const f = (id,l,val,ph,hint) => `<div class="mf"><label>${l}</label>
    <input id="${id}" value="${esc(val||'')}" placeholder="${esc(ph||'')}">
    ${hint?`<p class="fh">${esc(hint)}</p>`:''}</div>`;

  const common = `
    <div class="mf2">${f('kHandle','Handle',k.handle,'@handle')}
      <div class="mf"><label>Platform</label><select id="kPlat">
        ${['TikTok','Instagram','YouTube','Shopee Live','Xiaohongshu'].map(p=>
          `<option${k.platform===p?' selected':''}>${p}</option>`).join('')}</select></div></div>
    <div class="mf2">${f('kName','Display name',k.name)}
      <div class="mf"><label>Tier</label><select id="kTier">
        ${['Nano','Micro','Macro','Mega'].map(t=>`<option${k.tier===t?' selected':''}>${t}</option>`).join('')}</select></div></div>
    <div class="mf2"><div class="mf"><label>Remark</label><select id="kCreatorClass">
        ${['Creator','Artiste'].map(c=>`<option value="${c}"${inferredCreatorClass(k)===c?' selected':''}>${c}</option>`).join('')}</select>
        <p class="fh">Use Artiste for talent/rate-sheet records; Creator for normal KOL/UGC/live records.</p></div>
      ${f('kRecentBrandPosts','Past brand posts in last 60 days',k.recentBrandPosts,'brand/date/link summary only if verified')}</div>
    <div class="mf2">${f('kFoll','Followers',k.followers,'blank if unverified')}
      ${f('kAud','Audience',k.audience,'e.g. 82% female · 25–34 · SG')}</div>
    <div class="mf2"><div class="mf"><label>Primary audience market</label><select id="kMarket">
        <option value=""${!k.audienceMarket?' selected':''}>Not verified</option>
        ${AUDIENCE_MARKETS.map(m=>`<option value="${m}"${k.audienceMarket===m?' selected':''}>${m}</option>`).join('')}</select>
        <p class="fh">Set only once platform-native audience insights confirm this market is over 50% of the audience.</p></div>
      <div class="mf"></div></div>
    <div class="mf2">${f('kContact','Contact',k.contact,'email, agency, or DM open')}
      <div class="mf"><label>Contact method</label><select id="kContactMethod">
        <option value=""${!k.contactMethod?' selected':''}>Not set</option>
        ${CONTACT_METHODS.map(m=>`<option${k.contactMethod===m?' selected':''}>${m}</option>`).join('')}</select></div></div>
    ${f('kSource','Source URL',k.source,'where the figures were verified')}
    ${f('kSourceAgency','Sourcing agency',k.sourceAgency,'blank if sourced directly, e.g. Atisfyre')}`;

  const pricingHint = (field, plain) => {
    if(idx < 0 || !k.id) return '';
    const p = pendingFor('kol', k.id, field);
    if(!p) return '';
    const val = plain ? esc(p.to) : S.settings.cur + esc(p.to);
    return isAdmin()
      ? `A team change to ${val} is awaiting your decision — see Pending changes.`
      : `Your proposed change to ${val} is awaiting an administrator.`;
  };

  const ugcOnly = `
    <div class="mf2">${f('kEr','Engagement rate %',k.er,'blank if unverified')}
      ${f('kPosts','Total posts',k.posts)}</div>
    ${f('kRate','Rate per post',k.rate,'in ' + S.settings.cur, pricingHint('rate'))}`;

  const liveOnly = `
    <div class="mf2">${f('kViews','Average views per stream',k.avgViews,'blank if unverified')}
      ${f('kGmv','Average GMV per stream',k.avgGmv,'blank if unverified')}</div>
    <div class="mf2">${f('kGpm','GPM if known',k.gpm,'leave blank to calculate','Calculated as GMV ÷ views × 1,000 when both are entered')}
      ${f('kRet','Average view time',k.retention,'e.g. 6m 20s')}</div>
    ${f('kFee','Agreed fixed fee',k.fee,'in ' + S.settings.cur, pricingHint('fee'))}`;

  const termsBlock = `
    <div class="mf2">
      <div class="mf"><label>Commission</label><select id="kCommission">
        <option value=""${!k.commission?' selected':''}>Not agreed</option>
        ${COMMISSION_OPTIONS.map(c=>`<option${k.commission===c?' selected':''}>${c}</option>`).join('')}</select>
        ${pricingHint('commission', true)?`<p class="fh">${pricingHint('commission', true)}</p>`:''}</div>
      ${f('kPaymentTerms','Payment terms',k.paymentTerms,'e.g. 50% on confirmation, 50% on delivery', pricingHint('paymentTerms', true))}</div>`;

  const proofBlock = `
    <div class="mf2">${f('kProofLink','Proof of delivery link',k.proofLink,'posted content or stream link',
      'Required before this record can be marked Complete, unless a linked schedule entry already has one.')}
      ${f('kAdCode','Ad code',k.adCode,'spark ad code, if issued')}</div>`;

  const body = `
    <div class="mf"><label>Creator type</label>
      <div class="type-pick">${Object.values(KOL_TYPES).map(t=>
        `<label class="tp ${type===t.k?'on':''}">
          <input type="radio" name="ktype" value="${t.k}"${type===t.k?' checked':''}${idx>=0?' disabled':''}>
          <b>${esc(t.name)}</b><span>${esc(t.goal)}</span></label>`).join('')}</div></div>
    ${common}
    ${type === 'ugc' ? ugcOnly : liveOnly}
    ${termsBlock}
    ${proofBlock}
    <div class="mf"><label>Notes</label>
      <textarea id="kNotes" rows="3">${esc(k.notes||'')}</textarea></div>
    <div class="mf verify-note">Leave a field blank when you could not verify it.
      An empty field is honest; a guess presented as data is not.</div>
    ${(idx>=0 && isLocked(k) && !isAdmin())?`<div class="mf lock-note">This record is at the <b>${esc((KOL_PIPE.find(s=>s.k===k.stage)||{}).name)}</b> stage.
      A change to rate, fee, commission or payment terms is sent to an administrator for approval rather than applied immediately — everything else saves right away.</div>`:''}`;

  const btns = idx>=0
    ? (canDelete(k) ? [['Delete','del'],['Cancel','x'],['Save','ok']] : [['Cancel','x'],['Save','ok']])
    : [['Cancel','x'],['Add creator','ok']];

  modal(idx>=0 ? 'Edit creator' : 'Add creator', body, btns, a => {
    if(a === 'x') return true;
    if(a === 'del'){ delKol(idx); return true; }
    const h = el('kHandle').value.trim();
    if(!h){ toast('A handle is required'); return false; }
    if(looksLikeFollowerCount(h)){
      toast('That looks like a follower count, not a handle — check the source row and enter the real @handle');
      return false;
    }
    const picked = qs('input[name=ktype]:checked');
    const existing = idx>=0 ? S.kols[idx] : null;
    const rec = Object.assign({}, existing || {}, {
      id: existing ? (existing.id || ('K'+Date.now().toString(36)+Math.random().toString(36).slice(2,5))) : ('K'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)),
      type: picked ? picked.value : type,
      handle: h.startsWith('@') ? h : '@'+h,
      platform: el('kPlat').value, name: el('kName').value.trim(),
      tier: el('kTier').value, followers: el('kFoll').value.trim(),
      audience: el('kAud').value.trim(), audienceMarket: el('kMarket').value,
      contact: el('kContact').value.trim(),
      creatorClass: el('kCreatorClass').value,
      recentBrandPosts: el('kRecentBrandPosts').value.trim(),
      contactMethod: el('kContactMethod').value,
      source: el('kSource').value.trim(), sourceAgency: el('kSourceAgency').value.trim(),
      proofLink: el('kProofLink').value.trim(), adCode: el('kAdCode').value.trim(),
      notes: el('kNotes').value.trim(),
      stage: existing ? existing.stage : 'sourced',
      updatedAt: new Date().toISOString()
    });
    // Pricing on an existing record needs admin approval — team edits are held
    // as a proposal, exactly like SKU/bundle/month prices already are. Commission
    // and payment terms are agreed contractual terms just like rate/fee, so they
    // go through the same gate rather than writing straight through.
    const pricingChanges = [];
    const gatePricing = (field, next, label) => {
      const from = (existing && existing[field]) || '';
      if(!isAdmin() && existing && next !== from){
        pricingChanges.push({ field, from, to: next, label });
        return from; // live value stays put until approved
      }
      return next;
    };
    rec.commission = gatePricing('commission', el('kCommission').value, (existing?existing.handle:h) + ' — commission');
    rec.paymentTerms = gatePricing('paymentTerms', el('kPaymentTerms').value.trim(), (existing?existing.handle:h) + ' — payment terms');
    if((picked?picked.value:type) === 'ugc'){
      rec.er = el('kEr').value.trim(); rec.posts = el('kPosts').value.trim();
      rec.rate = gatePricing('rate', el('kRate').value.trim(), (existing?existing.handle:h) + ' — rate per post');
    } else {
      rec.avgViews = el('kViews').value.trim(); rec.avgGmv = el('kGmv').value.trim();
      rec.gpm = el('kGpm').value.trim(); rec.retention = el('kRet').value.trim();
      rec.fee = gatePricing('fee', el('kFee').value.trim(), (existing?existing.handle:h) + ' — agreed fixed fee');
      rec.fit = rec.fit || {};
    }
    if(idx>=0) S.kols[idx] = rec; else S.kols.push(rec);
    pricingChanges.forEach(c => propose('kol', rec.id, c.field, c.from, c.to, c.label));
    save(); renderKol(); renderOverview();
    toast(pricingChanges.length ? 'Sent for approval — pricing needs an administrator to confirm'
      : (idx>=0 ? 'Creator updated' : 'Creator added'));
    return true;
  });

  qsa('.tp input').forEach(r => r.addEventListener('change', () => {
    closeModal(); kolForm(idx, Object.assign({}, k, { type: r.value }));
  }));
}

function showCreatorCard(idx){
  const k = S.kols[idx];
  if(!k) return;
  const g = computeGpm(k);
  const roas = creatorRoas(k);
  const rating = creatorRating(k);
  const dup = duplicateInfoFor(k);
  const sc = scenarioFor(k);
  modal(`Creator card — ${k.handle || 'creator'}`, `
    <div class="creator-card">
      <div class="cc-top">
        <div><b>${esc(k.handle || '')}</b><span>${esc(k.platform || '')}${k.name?' · '+esc(k.name):''}</span></div>
        <span class="pill ${rating.tone}">${esc(rating.label)}</span>
      </div>
      ${dup?`<div class="dup-note"><b>Potential duplicate.</b> Same handle appears ${dup.length} times: ${dup.map(x => esc((x.k.type||'ugc').toUpperCase() + ' / ' + (x.k.stage||''))).join(', ')}.</div>`:''}
      <div class="cc-grid">
        <div><span>Remark</span><b>${esc(inferredCreatorClass(k))}</b></div>
        <div><span>Tier</span><b>${esc(followerTier(k) || k.tier || 'not verified')}</b></div>
        <div><span>Followers</span><b>${esc(k.followers || 'not verified')}</b></div>
        <div><span>Market &gt;50%</span><b>${esc(k.audienceMarket || 'not verified')}</b></div>
        <div><span>Score</span><b>${creatorScore(k)}/100</b></div>
        <div><span>Fit</span><b>${fitScore(k)}/10</b></div>
        <div><span>GPM</span><b>${g ? '$' + Math.round(g).toLocaleString() : 'not verified'}</b></div>
        <div><span>ROAS</span><b>${roas ? roas.toFixed(1) + '×' : 'not verified'}</b></div>
        <div><span>Recommended</span><b>${esc(sc.name)}</b></div>
      </div>
      <div class="cc-note"><b>How this is derived</b><p>${esc(metricHelp(k))}</p></div>
      <div class="cc-note"><b>60-day brand posts</b><p>${esc(k.recentBrandPosts || 'Not verified yet. Add brand/date/link evidence from TikTok, Instagram, affiliate storefront, or agency sheet.')}</p></div>
      <div class="cc-note"><b>Notes</b><p>${esc(k.notes || 'No notes recorded.')}</p></div>
      ${k.source?`<a class="src-ln" href="${esc(k.source)}" target="_blank" rel="noopener">Open source</a>`:''}
    </div>`, [['Close','x'],['Edit','edit']], a => {
      if(a === 'edit'){ kolForm(idx); return true; }
      return true;
    });
}

function delKol(idx){
  const k = S.kols[idx];
  if(!canDelete(k)){
    modal('This record cannot be removed', `<p style="font-size:13.5px;line-height:1.6;color:var(--mute)">
      <b style="color:var(--ink)">${esc(k.handle)}</b> can only be deleted by an administrator.</p>
      <p style="font-size:13px;color:var(--mute);margin-top:10px">
      Team members can add creators, edit their details, and move them through the pipeline, but
      deletion is admin-only so a record can't be removed by mistake. Ask an administrator if this
      one was created in error.</p>`,
      [['Close','x']], ()=>true);
    return;
  }
  modal('Delete this creator?', `<p style="font-size:13.5px;color:var(--mute);line-height:1.6">
    <b style="color:var(--ink)">${esc(k.handle)}</b> will be removed along with anything scheduled
    against them. This cannot be undone.</p>`,
    [['Keep','x'],['Delete','ok']], a => {
      if(a !== 'ok') return true;
      // Tombstoned, not just spliced out — Live sync merges by id across
      // browsers, and without a tombstone a delete here would silently come
      // back the next time someone else's browser pushes its still-intact copy.
      const now = new Date().toISOString();
      S.scheduleTombstones = S.scheduleTombstones || [];
      (S.schedule||[]).filter(e => e.kol === k.handle).forEach(e => S.scheduleTombstones.push({ id:e.id, at:now }));
      S.schedule = (S.schedule||[]).filter(e => e.kol !== k.handle);
      S.kolTombstones = S.kolTombstones || [];
      S.kolTombstones.push({ id:k.id, at:now });
      S.kols.splice(idx,1); save(); renderKol(); renderOverview();
      toast('Creator removed');
      return true;
    });
}

/* ── fit checklist ── */
function fitForm(idx){
  const k = S.kols[idx];
  k.fit = k.fit || {};
  const cats = [...new Set(FIT_FACTORS.map(f=>f.cat))];

  modal(`Fit check — ${k.handle}`, `
    <div class="fit-intro">Tick only what you have actually seen. The score sets which fee is rational —
      over-ticking here is how a brand ends up paying a mega fee for a test-tier creator.</div>
    ${cats.map(c => `<div class="fit-cat"><span class="fc-l">${esc(c)}</span>
      ${FIT_FACTORS.filter(f=>f.cat===c).map(f => `
        <label class="fit-i ${f.critical?'crit':''}">
          <input type="checkbox" data-fit="${f.k}"${k.fit[f.k]?' checked':''}>
          <span><b>${esc(f.name)}${f.critical?' <em>critical</em>':''}</b>${esc(f.test)}</span></label>`).join('')}
    </div>`).join('')}
    <div id="fitOut"></div>`,
    [['Cancel','x'],['Save assessment','ok']], a => {
      if(a !== 'ok') return true;
      qsa('[data-fit]').forEach(c => { k.fit[c.dataset.fit] = c.checked; });
      k.updatedAt = new Date().toISOString();
      save(); renderKol();
      toast('Assessment saved');
      return true;
    });

  const upd = () => {
    const tmp = {}; qsa('[data-fit]').forEach(c => tmp[c.dataset.fit] = c.checked);
    const fake = Object.assign({}, k, { fit: tmp });
    const score = FIT_FACTORS.filter(f=>tmp[f.k]).length;
    const crit = FIT_FACTORS.filter(f=>f.critical && !tmp[f.k]);
    const sc = scenarioFor(fake);
    const g = computeGpm(k);
    const band = gpmBand(g);
    el('fitOut').innerHTML = `
      <div class="fit-res">
        <div class="fr-top">
          <div><span class="fr-l">Score</span><b class="fr-s">${score}<i>/10</i></b></div>
          <div><span class="fr-l">GPM</span><b>${g?'$'+Math.round(g).toLocaleString():'unknown'}</b>
            <span class="pill ${band.tone}">${band.label}</span></div>
        </div>
        ${crit.length?`<div class="fr-crit">Critical check missing — <b>${crit.map(c=>esc(c.name)).join(' and ')}</b>.
          The guide says never to skip these regardless of follower count. Terms are capped until they are met.</div>`:''}
        <div class="fr-sc ${sc.tone}">
          <div class="frs-h"><b>${esc(sc.name)}</b><span>${esc(sc.phase)}</span></div>
          <div class="frs-terms">${sc.fee
            ? `${S.settings.cur}${sc.fee.toLocaleString()} fixed + ${sc.comm}% commission`
            : `${sc.comm}% commission only — no fixed fee`}</div>
          ${sc.fee?`<div class="frs-be">Break-even GMV ${S.settings.cur}${breakEvenFor(sc.fee).toLocaleString()}
            <span class="be-m">at ${Math.round(BE_MARGIN*100)}% contribution margin</span></div>`:''}
          <p>${esc(sc.why)}</p>
          ${sc.capped?`<div class="frs-cap">Capped — ${esc(sc.capReason)}</div>`:''}
        </div>
      </div>`;
  };
  qsa('[data-fit]').forEach(c => c.addEventListener('change', upd));
  upd();
}

/* ── partnership angles — which job a creator's content does, per SKU.
   Distinct from buildCreatorBrief below: that's a script for one booked
   creator; this is the strategy layer that decides which angle to book
   them for in the first place. ── */
const ANGLE_TYPE_TONE = {
  'Diary / challenge':'p-v', 'Reversal':'p-a', 'Replacement':'p-g',
  'Trust / first touch':'p-n', 'Habit / wear-test':'p-a', 'Continuity':'p-g'
};
function angleCreatorFitLabel(a){
  if(a.fitCreator === 'either') return 'UGC or Livestream';
  return (KOL_TYPES[a.fitCreator] || {}).name || a.fitCreator;
}
function buildAngleBrief(a){
  const sku = SKUS.find(s => s.id === a.skuId);
  const lane = DNUVO_MESSAGE_STACK.find(m => m.lane === a.lane) || DNUVO_MESSAGE_STACK[0];
  return `PARTNERSHIP ANGLE — ${a.name}
SKU: ${sku ? sku.name : a.skuId}   Angle type: ${a.type}   Best fit: ${angleCreatorFitLabel(a)}

WHAT THIS PROVES
${a.condition}

MESSAGE LANE
"${lane.text}" (${a.lane})

FORMAT
${a.format}

PROOF REQUIRED BEFORE THIS CAN BE POSTED
${a.proof}

PRACTICAL STEPS
${a.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}

CALL TO ACTION
${a.cta}

RULES
- Do not state a clinical claim or number beyond what's in the approved messaging stack.
- If proof isn't verified yet, hold the post rather than publish an estimate.`;
}
function renderKolContentAngles(){
  const box = el('kolAngles'); if(!box) return;
  box.innerHTML = `<div class="pf-grid">${PARTNERSHIP_ANGLES.map(a => {
    const sku = SKUS.find(s => s.id === a.skuId);
    const tone = ANGLE_TYPE_TONE[a.type] || 'p-n';
    return `<div class="pf-card">
      <div class="pf-h"><b>${esc(a.name)}</b><span class="pill ${tone}">${esc(a.type)}</span></div>
      <div class="pf-meta">${esc(sku?sku.name:a.skuId)} · ${esc(angleCreatorFitLabel(a))} · ${esc(a.lane)} lane</div>
      <p><b>Proves:</b> ${esc(a.condition)}</p>
      <p><b>Format:</b> ${esc(a.format)}</p>
      <p><b>Proof required:</b> ${esc(a.proof)}</p>
      <p><b>CTA:</b> ${esc(a.cta)}</p>
      <button class="btn-line sm" style="margin-top:8px" data-angle-brief="${a.id}">Copy angle brief</button>
    </div>`;
  }).join('')}</div>`;

  qsa('[data-angle-brief]', box).forEach(b => b.addEventListener('click', () => {
    const a = PARTNERSHIP_ANGLES.find(x => x.id === b.dataset.angleBrief);
    if(!a) return;
    navigator.clipboard.writeText(buildAngleBrief(a))
      .then(()=>toast('Angle brief copied'))
      .catch(()=>toast('Select the text and copy manually'));
  }));
}

/* ── creator brief — a real UGC script/edit-brief for a real roster
   creator, distinct from the Content module's synthetic-persona ad
   prompts. Same "verified data only, no invented claims" standard
   applied throughout this app's KOL tooling. ── */
function buildCreatorBrief(idx){
  const k = S.kols[idx];
  const type = k.type || 'ugc';
  const T = KOL_TYPES[type];
  const times = POSTING_TIMES[k.platform] || [];
  const lane = type === 'live'
    ? (DNUVO_MESSAGE_STACK.find(m => m.lane === 'Credibility') || DNUVO_MESSAGE_STACK[0])
    : (DNUVO_MESSAGE_STACK.find(m => m.lane === 'Emotional') || DNUVO_MESSAGE_STACK[0]);
  const deliverable = (DELIVERABLES[type] || [])[0] || 'Content piece';
  const feeText = type === 'live'
    ? (k.fee ? S.settings.cur + k.fee : 'terms not yet agreed')
    : (k.rate ? S.settings.cur + k.rate : 'terms not yet agreed');

  return `CREATOR BRIEF — ${k.handle}
Platform: ${k.platform || '—'}   Type: ${T ? T.name : type}
Deliverable: ${deliverable}
Terms: ${feeText}

MESSAGE TO WORK IN
"${lane.text}" (${lane.lane} lane)

SCRIPT / SHOT OUTLINE
1. Hook (first 2 seconds) — product in hand or on skin immediately, no long intro.
2. Problem — name the real skin frustration this solves (barrier damage, dullness, breakouts — whatever's true for you).
3. Product moment — apply on camera, describe what it actually feels like. No claim beyond the line above.
4. Payoff — what changed, in your own words.
5. CTA — point to the shop link or bio, one clear next step.

BEST TIME TO POST
${times.length ? times.join(' or ') : 'No guidance on file for this platform — check your own analytics.'}
(Starting point only — verify against this account's own audience-activity data.)

RULES
- Do not state a clinical claim or number beyond what's in the approved messaging stack.
- Keep it in your own voice — this is a brief, not a script to read verbatim.`;
}

function showCreatorBrief(idx){
  const k = S.kols[idx];
  const brief = buildCreatorBrief(idx);
  modal(`Brief — ${k.handle}`, `<pre class="brief-out">${esc(brief)}</pre>`,
    [['Close','x'],['Copy','copy']], a => {
      if(a === 'copy'){
        navigator.clipboard.writeText(brief)
          .then(()=>toast('Brief copied'))
          .catch(()=>toast('Select the text and copy manually'));
        return false;
      }
      return true;
    });
}

/* ── scheduling ── */
function schedForm(idx){
  const k = S.kols[idx];
  const type = k.type || 'ugc';
  const today = new Date().toISOString().slice(0,10);
  modal(`Schedule — ${k.handle}`, `
    <div class="mf2">
      <div class="mf"><label>Deliverable</label><select id="scType">
        ${DELIVERABLES[type].map(d=>`<option>${esc(d)}</option>`).join('')}</select></div>
      <div class="mf"><label>Date</label><input type="date" id="scDate" value="${today}"></div>
    </div>
    <div class="mf2">
      <div class="mf"><label>Time</label><input type="time" id="scTime" value="19:00"></div>
      <div class="mf"><label>Owner</label><input id="scOwner" placeholder="Who is running it"></div>
    </div>
    <div class="mf"><label>Notes</label><textarea id="scNote" rows="2" placeholder="Offer, bundle price, talking points"></textarea></div>
    <div class="mf2">
      <div class="mf"><label>Proof of delivery link</label><input id="scProof" placeholder="fill in once posted/streamed">
        <p class="fh">Required before this entry can be marked done — can be left blank now and added later.</p></div>
      <div class="mf"><label>Ad code</label><input id="scAdCode" placeholder="if issued"></div>
    </div>`,
    [['Cancel','x'],['Add to schedule','ok']], a => {
      if(a !== 'ok') return true;
      S.schedule = S.schedule || [];
      S.schedule.push({
        id:'E'+Date.now().toString(36), kol:k.handle, type,
        what: el('scType').value, date: el('scDate').value, time: el('scTime').value,
        owner: el('scOwner').value.trim(), note: el('scNote').value.trim(),
        proofLink: el('scProof').value.trim(), adCode: el('scAdCode').value.trim(),
        done:false, board:'planned',
        feeAgreed: num(type === 'live' ? k.fee : k.rate) || 0, paidStatus:'unpaid',
        at:new Date().toISOString(), updatedAt:new Date().toISOString()
      });
      if(k.stage === 'approved') k.stage = 'scheduled';
      save(); renderKol();
      toast('Added to the schedule');
      return true;
    });
}

/* Status used by the Post-stage activity list's dropdown — the same
   board taxonomy the Kanban view already uses (SCHED_BOARD), plus a
   computed Overdue for anything past its date and not yet done. The
   filter only changes what's displayed; S.schedule itself is untouched,
   so switching the dropdown never loses a record. */
function activityStatusOf(e){
  const today = new Date().toISOString().slice(0,10);
  if(!e.done && e.date < today) return 'overdue';
  return schedBoardOf(e);
}
const ACTIVITY_STATUS_OPTIONS = [
  { k:'all', name:'All' },
  { k:'planned', name:'Planned (new)' },
  { k:'confirmed', name:'Confirmed' },
  { k:'live', name:'Live' },
  { k:'done', name:'Done (past)' },
  { k:'overdue', name:'Overdue' }
];

function renderKolSchedule(){
  const box = el('kolSched'); if(!box) return;
  const all = (S.schedule || []).slice().sort((a,b) =>
    (a.date+a.time).localeCompare(b.date+b.time));
  if(!all.length){
    box.innerHTML = `<p class="empty">Nothing scheduled. Use <b>Schedule</b> on a creator to book a
      deliverable or a live session.</p>`;
    return;
  }
  const today = new Date().toISOString().slice(0,10);
  const filterBar = `<div class="sched-status-filter">
    <label>Status <select id="schedStatusFilter">
      ${ACTIVITY_STATUS_OPTIONS.map(o => `<option value="${o.k}"${schedStatusFilter===o.k?' selected':''}>${esc(o.name)}</option>`).join('')}
    </select></label>
    <span class="sub">${all.length} total recorded — filter only changes this view</span>
  </div>`;
  const list = schedStatusFilter === 'all' ? all : all.filter(e => activityStatusOf(e) === schedStatusFilter);
  if(!list.length){
    box.innerHTML = filterBar + `<p class="empty">No activities match this filter. ${all.length} recorded overall — change the filter above to see them.</p>`;
    el('schedStatusFilter').addEventListener('change', e => { schedStatusFilter = e.target.value; renderKolSchedule(); });
    return;
  }
  box.innerHTML = filterBar + `<div class="tb-wrap"><table class="tb" id="schedTable">
    <thead><tr><th>Date</th><th>Time</th><th>Creator</th><th>Type</th><th>Deliverable</th>
      <th>Owner</th><th>Notes</th><th>Proof</th><th>Status</th><th class="n">Fee</th><th>Payment</th><th></th></tr></thead><tbody>` +
    list.map(e => {
      const past = e.date < today;
      const kol = S.kols.find(x => x.handle === e.kol);
      return `<tr class="${e.done?'sc-done':past&&!e.done?'sc-late':''}">
        <td class="n"><b>${esc(e.date)}</b></td>
        <td class="n">${esc(e.time||'')}</td>
        <td><b>${esc(e.kol)}</b></td>
        <td><span class="pill ${KOL_TYPES[e.type]?KOL_TYPES[e.type].pill:'p-n'}">${KOL_TYPES[e.type]?KOL_TYPES[e.type].short:'—'}</span></td>
        <td>${esc(e.what)}</td>
        <td>${esc(e.owner||'—')}</td>
        <td style="font-size:12px;color:var(--mute)">${esc(e.note||'')}</td>
        <td>${e.proofLink
          ?`<a href="${esc(e.proofLink)}" target="_blank" rel="noopener" class="k-handle-link">Link</a>`
          :`<button class="btn-line sm" data-scproof="${e.id}">Add link</button>`}</td>
        <td>${e.done?`<span class="pill p-g">Done</span>`
              :past?`<span class="pill p-r">Overdue</span>`
              :`<span class="pill p-a">Booked</span>`}</td>
        <td class="n">${e.feeAgreed?esc(S.settings.cur+e.feeAgreed):'—'}</td>
        <td>${payCell(e)}</td>
        <td><div class="k-acts">
          <button class="btn-line sm" data-scdone="${e.id}">${e.done?'Reopen':'Mark done'}</button>
          <button class="btn-line sm" data-scics="${e.id}">Calendar</button>
          ${(isAdmin()||!e.done)?`<button class="btn-line sm danger" data-scdel="${e.id}">Remove</button>`:''}
        </div></td></tr>`;
    }).join('') + `</tbody></table></div>`;

  el('schedStatusFilter').addEventListener('change', e => { schedStatusFilter = e.target.value; renderKolSchedule(); });
  qsa('[data-scdone]').forEach(b => b.addEventListener('click', () => {
    const e = S.schedule.find(x=>x.id===b.dataset.scdone);
    if(!e.done && !e.proofLink){
      toast('Add a proof-of-delivery link before marking this done — open the entry from the Calendar to add one');
      return;
    }
    e.done = !e.done; e.board = e.done ? 'done' : 'planned'; e.updatedAt = new Date().toISOString();
    save(); renderKol();
  }));
  qsa('[data-scdel]').forEach(b => b.addEventListener('click', () => {
    S.scheduleTombstones = S.scheduleTombstones || [];
    S.scheduleTombstones.push({ id:b.dataset.scdel, at:new Date().toISOString() });
    S.schedule = S.schedule.filter(x=>x.id!==b.dataset.scdel);
    save(); renderKolSchedule(); toast('Removed from the schedule');
  }));
  qsa('[data-scproof]').forEach(b => b.addEventListener('click', () => {
    showScheduleEntry(b.dataset.scproof);
  }));
  qsa('[data-scics]').forEach(b => b.addEventListener('click', () => {
    downloadIcs(S.schedule.find(x=>x.id===b.dataset.scics));
  }));
  qsa('[data-pay]').forEach(s => s.addEventListener('change', () => {
    const e = S.schedule.find(x=>x.id===s.dataset.pay);
    if(e){ e.paidStatus = s.value; e.updatedAt = new Date().toISOString(); save(); renderKolPayments(); }
  }));

  const dl = el('schedAllIcs');
  if(dl) dl.onclick = () => downloadIcs(null);
}

/* Kanban view of the same S.schedule — drag a card between columns to
   move it through SCHED_BOARD. Dragging into/out of "Done" also syncs
   the `done` boolean so the Table view's done/late styling stays in
   sync either way. */
function renderKolScheduleBoard(){
  const box = el('kolSchedBoard'); if(!box) return;
  const all = S.schedule || [];
  const list = schedBoardFilters.type ? all.filter(e => e.type === schedBoardFilters.type) : all;

  const filterBar = `<div class="sched-board-filters">
    <select id="schedBoardTypeFilter"><option value="">Both — UGC and Livestream</option>
      ${Object.values(KOL_TYPES).map(t => `<option value="${t.k}"${schedBoardFilters.type===t.k?' selected':''}>${esc(t.name)} only</option>`).join('')}</select>
  </div>`;

  box.innerHTML = filterBar + `<div class="sched-board">${SCHED_BOARD.map(col => {
    const cards = list.filter(e => schedBoardOf(e) === col.k);
    return `<div class="sched-col" data-col="${col.k}">
      <div class="sched-col-h">${esc(col.name)}<span class="sched-col-n">${cards.length}</span></div>
      <div class="sched-col-body" data-coldrop="${col.k}">
        ${cards.map(e => `<div class="sched-card" draggable="true" data-cardid="${e.id}">
          <div class="sc-top"><b>${esc(e.kol)}</b><span class="pill ${KOL_TYPES[e.type]?KOL_TYPES[e.type].pill:'p-n'}">${KOL_TYPES[e.type]?KOL_TYPES[e.type].short:'—'}</span></div>
          <span class="sub">${esc(e.what)}</span>
          <span class="sc-date">${esc(e.date)}${e.time?' · '+esc(e.time):''}</span>
          ${e.feeAgreed ? `<span class="sc-fee">${esc(S.settings.cur+e.feeAgreed)} · ${
            (e.paidStatus||'unpaid')==='paid'?'Paid':(e.paidStatus||'unpaid')==='deposit'?'Deposit paid':'Unpaid'}</span>` : ''}
          <span class="sc-proof ${e.proofLink?'has':''}">${e.proofLink?'Proof on file':'No proof yet'}</span>
        </div>`).join('') || '<p class="sched-empty">Nothing here</p>'}
      </div>
    </div>`;
  }).join('')}</div>`;

  el('schedBoardTypeFilter').addEventListener('change', e => {
    schedBoardFilters.type = e.target.value; renderKolScheduleBoard();
  });

  qsa('.sched-card', box).forEach(card => {
    card.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('text/plain', card.dataset.cardid);
      ev.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  qsa('[data-coldrop]', box).forEach(col => {
    col.addEventListener('dragover', ev => {
      ev.preventDefault();
      col.closest('.sched-col').classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.closest('.sched-col').classList.remove('drag-over'));
    col.addEventListener('drop', ev => {
      ev.preventDefault();
      col.closest('.sched-col').classList.remove('drag-over');
      const id = ev.dataTransfer.getData('text/plain');
      const e = (S.schedule||[]).find(x => x.id === id);
      if(!e) return;
      const colKey = col.dataset.coldrop;
      if(colKey === 'done' && !e.proofLink){
        toast('Add a proof-of-delivery link before moving this to Done');
        renderKolScheduleBoard();
        return;
      }
      e.board = colKey;
      e.done = (colKey === 'done');
      e.updatedAt = new Date().toISOString();
      save();
      renderKolSchedule();
      renderKolScheduleBoard();
    });
  });
}

/* Month calendar view of the same S.schedule — the umbrella surface: what
   every creator is doing and when, across both UGC and livestream lanes,
   with overdue entries flagged in place rather than only in a table. */
function pad2(n){ return String(n).padStart(2,'0'); }
function ymd(y,m,d){ return `${y}-${pad2(m+1)}-${pad2(d)}`; }

function renderKolScheduleCalendar(){
  const box = el('kolSchedCal'); if(!box) return;
  const all = S.schedule || [];
  if(!all.length){
    box.innerHTML = `<p class="empty">Nothing scheduled. Use <b>Schedule</b> on a creator to book a
      deliverable or a live session.</p>`;
    return;
  }
  if(!schedCalMonth){
    const n = new Date();
    schedCalMonth = new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1));
  }
  const y = schedCalMonth.getUTCFullYear(), m = schedCalMonth.getUTCMonth();
  const today = new Date().toISOString().slice(0,10);

  const kolOptions = [...new Set(all.map(e => e.kol))].sort();
  const statusOf = e => e.done ? 'done' : (e.date < today ? 'overdue' : 'booked');
  const list = all.filter(e =>
    (!schedCalFilters.kol || e.kol === schedCalFilters.kol) &&
    (!schedCalFilters.type || e.type === schedCalFilters.type) &&
    (!schedCalFilters.status || statusOf(e) === schedCalFilters.status));

  const firstWeekday = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = [];
  for(let i = 0; i < firstWeekday; i++) cells.push(null);
  for(let d = 1; d <= daysInMonth; d++) cells.push(d);
  while(cells.length % 7) cells.push(null);

  const weekdayHead = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    .map(w => `<div class="cal-wd">${w}</div>`).join('');

  const dayCells = cells.map(d => {
    if(!d) return `<div class="cal-cell cal-out"></div>`;
    const dateStr = ymd(y, m, d);
    const entries = list.filter(e => e.date === dateStr);
    const chips = entries.map(e => {
      const st = statusOf(e);
      return `<button class="cal-chip cal-${st}" data-cal-entry="${e.id}"
        title="${esc(e.kol)} — ${esc(e.what)}${e.time?' · '+esc(e.time):''}">
        <span class="cc-k">${esc(e.kol)}</span><span class="cc-w">${esc(e.what)}</span></button>`;
    }).join('');
    return `<div class="cal-cell${dateStr===today?' cal-today':''}">
      <div class="cal-daynum">${d}</div>
      <div class="cal-entries">${chips}</div>
    </div>`;
  }).join('');

  box.innerHTML = `
    <div class="cal-nav">
      <button class="btn-line sm" id="calPrev">‹</button>
      <b class="cal-label">${esc(MONTH_NAMES[m])} ${y}</b>
      <button class="btn-line sm" id="calNext">›</button>
      <button class="btn-line sm" id="calToday">Today</button>
      <div class="cal-filters">
        <select id="calFilterKol"><option value="">All creators</option>
          ${kolOptions.map(h => `<option value="${esc(h)}"${schedCalFilters.kol===h?' selected':''}>${esc(h)}</option>`).join('')}</select>
        <select id="calFilterType"><option value="">All types</option>
          ${Object.values(KOL_TYPES).map(t => `<option value="${t.k}"${schedCalFilters.type===t.k?' selected':''}>${esc(t.name)}</option>`).join('')}</select>
        <select id="calFilterStatus"><option value="">All statuses</option>
          <option value="booked"${schedCalFilters.status==='booked'?' selected':''}>Booked</option>
          <option value="overdue"${schedCalFilters.status==='overdue'?' selected':''}>Overdue</option>
          <option value="done"${schedCalFilters.status==='done'?' selected':''}>Done</option>
        </select>
      </div>
    </div>
    <div class="cal-grid">${weekdayHead}${dayCells}</div>`;

  el('calPrev').addEventListener('click', () => {
    schedCalMonth = new Date(Date.UTC(y, m - 1, 1)); renderKolScheduleCalendar();
  });
  el('calNext').addEventListener('click', () => {
    schedCalMonth = new Date(Date.UTC(y, m + 1, 1)); renderKolScheduleCalendar();
  });
  el('calToday').addEventListener('click', () => {
    schedCalMonth = null; renderKolScheduleCalendar();
  });
  el('calFilterKol').addEventListener('change', e => { schedCalFilters.kol = e.target.value; renderKolScheduleCalendar(); });
  el('calFilterType').addEventListener('change', e => { schedCalFilters.type = e.target.value; renderKolScheduleCalendar(); });
  el('calFilterStatus').addEventListener('change', e => { schedCalFilters.status = e.target.value; renderKolScheduleCalendar(); });
  qsa('[data-cal-entry]', box).forEach(b => b.addEventListener('click', () => showScheduleEntry(b.dataset.calEntry)));
}

/* Quick-view for a single schedule entry, opened from a calendar chip —
   same actions as the Table view's row (done/reopen, remove, .ics, payment
   status) so nothing new has to be learned to act from the calendar. */
function showScheduleEntry(id){
  const e = (S.schedule || []).find(x => x.id === id);
  if(!e) return;
  const today = new Date().toISOString().slice(0,10);
  const past = e.date < today;
  const statusPill = e.done ? `<span class="pill p-g">Done</span>`
    : past ? `<span class="pill p-r">Overdue</span>`
    : `<span class="pill p-a">Booked</span>`;

  modal(`${e.kol} — ${e.what}`, `
    <div class="mf2">
      <div class="mf"><label>Date</label><p>${esc(e.date)}${e.time?' · '+esc(e.time):''}</p></div>
      <div class="mf"><label>Status</label><p>${statusPill}</p></div>
    </div>
    <div class="mf2">
      <div class="mf"><label>Type</label><p>${KOL_TYPES[e.type]?esc(KOL_TYPES[e.type].name):'—'}</p></div>
      <div class="mf"><label>Owner</label><p>${esc(e.owner||'—')}</p></div>
    </div>
    ${e.note?`<div class="mf"><label>Notes</label><p>${esc(e.note)}</p></div>`:''}
    <div class="mf2">
      <div class="mf"><label>Fee</label><p>${e.feeAgreed?esc(S.settings.cur+e.feeAgreed):'—'}</p></div>
      <div class="mf"><label>Payment</label>${payCell(e)}</div>
    </div>
    <div class="mf2">
      <div class="mf"><label>Proof of delivery link</label>
        <input id="seProof" value="${esc(e.proofLink||'')}" placeholder="posted content or stream link">
        <p class="fh">Required before this can be marked done.</p></div>
      <div class="mf"><label>Ad code</label><input id="seAdCode" value="${esc(e.adCode||'')}" placeholder="if issued"></div>
    </div>`,
    [['Close','x'], ['Calendar','ics'], [e.done?'Reopen':'Mark done','done'],
      ...(isAdmin()||!e.done ? [['Remove','del']] : [])], a => {
      if(a === 'ics'){ downloadIcs(e); return false; }
      if(a === 'done'){
        const proofNow = el('seProof').value.trim();
        if(!e.done && !proofNow){
          toast('Add a proof-of-delivery link before marking this done');
          return false;
        }
        e.proofLink = proofNow; e.adCode = el('seAdCode').value.trim();
        e.done = !e.done; e.board = e.done ? 'done' : 'planned'; e.updatedAt = new Date().toISOString();
        save(); renderKol(); return true;
      }
      if(a === 'del'){
        S.scheduleTombstones = S.scheduleTombstones || [];
        S.scheduleTombstones.push({ id, at:new Date().toISOString() });
        S.schedule = S.schedule.filter(x=>x.id!==id); save(); renderKol(); toast('Removed from the schedule'); return true;
      }
      return true;
    });
  el('seProof').addEventListener('change', ev => { e.proofLink = ev.target.value.trim(); e.updatedAt = new Date().toISOString(); save(); });
  el('seAdCode').addEventListener('change', ev => { e.adCode = ev.target.value.trim(); e.updatedAt = new Date().toISOString(); save(); });
  qsa('[data-pay]').forEach(s => s.addEventListener('change', () => {
    const ent = S.schedule.find(x=>x.id===s.dataset.pay);
    if(ent){ ent.paidStatus = s.value; ent.updatedAt = new Date().toISOString(); save(); renderKol(); }
  }));
}

/* .ics so it drops into any calendar app */
function icsDate(d, t){
  const [y,m,dd] = d.split('-');
  const [hh,mm] = (t||'09:00').split(':');
  return `${y}${m}${dd}T${hh}${mm}00`;
}
function downloadIcs(one){
  const list = one ? [one] : (S.schedule||[]);
  if(!list.length){ toast('Nothing to export'); return; }
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//dnuvo//launch console//EN','CALSCALE:GREGORIAN'];
  list.forEach(e => {
    const st = icsDate(e.date, e.time);
    const [hh,mm] = (e.time||'09:00').split(':');
    const endH = String((+hh + 1) % 24).padStart(2,'0');
    const en = icsDate(e.date, `${endH}:${mm}`);
    lines.push('BEGIN:VEVENT',
      `UID:${e.id}@dnuvo`,
      `DTSTAMP:${icsDate(new Date().toISOString().slice(0,10),'09:00')}Z`,
      `DTSTART:${st}`, `DTEND:${en}`,
      `SUMMARY:${e.kol} — ${e.what}`,
      `DESCRIPTION:${(e.note||'').replace(/\n/g,'\\n')}${e.owner?'\\nOwner: '+e.owner:''}`,
      'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  dl(one ? `${slug(one.kol)}-${one.date}.ics` : `dnuvo-kol-schedule-${stamp()}.ics`,
     lines.join('\r\n'), 'text/calendar');
  toast(one ? 'Calendar file downloaded' : 'Full schedule downloaded');
}

/* ── CRM with send routes ── */
function renderCrm(){
  const ks = el('crmKol'), st = el('crmStage'), rt = el('crmVia');
  const list = S.kols.filter(k => (k.type||'ugc') === kolTab);
  ks.innerHTML = list.length
    ? list.map(k => `<option value="${S.kols.indexOf(k)}">${esc(k.handle)} — ${esc(k.tier||'')}</option>`).join('')
    : `<option value="-1">No ${KOL_TYPES[kolTab].name.toLowerCase()}s yet</option>`;
  st.innerHTML = CRM_MSGS.map((m,i)=>`<option value="${i}">${esc(m.name)}</option>`).join('');
  rt.innerHTML = SEND_ROUTES.map(r=>`<option value="${r.k}">${esc(r.name)}</option>`).join('');

  const upd = () => {
    const m = CRM_MSGS[+st.value] || CRM_MSGS[0];
    const k = S.kols[+ks.value] || {};
    const sc = (k.type === 'live') ? scenarioFor(k) : null;
    const body = m.body
      .replace(/{{name}}/g, k.name || (k.handle||'there').replace('@',''))
      .replace(/{{brand}}/g, S.settings.brand)
      .replace(/{{market}}/g, S.settings.market)
      .replace(/{{platform}}/g, k.platform || 'TikTok')
      .replace(/{{product}}/g, S.skus[0].name)
      .replace(/{{code}}/g, (k.handle||'CODE').replace('@','').toUpperCase().slice(0,10)+'10')
      .replace(/{{sender}}/g, 'The team')
      .replace(/{{tracking}}/g, '[tracking number]')
      .replace(/{{fee}}/g, sc && sc.fee ? S.settings.cur+sc.fee.toLocaleString()+' plus '+sc.comm+'% commission' : '[fee]')
      .replace(/{{dates}}/g, '[offer three dates]')
      .replace(/{{results}}/g, '[results]');
    el('crmSubj').textContent = m.subj;
    el('crmText').value = body;
    const route = SEND_ROUTES.find(r=>r.k===rt.value) || SEND_ROUTES[0];
    el('crmNext').innerHTML = `<b>After sending:</b> ${esc(m.next)}
      <span class="crm-hint">${esc(route.hint)}</span>`;
  };
  [ks,st,rt].forEach(s => { s.onchange = upd; });
  upd();

  el('crmSend').onclick = () => {
    const route = rt.value;
    const k = S.kols[+ks.value] || {};
    const m = CRM_MSGS[+st.value] || CRM_MSGS[0];
    const text = el('crmText').value;
    const subj = `${S.settings.brand} — ${m.subj}`;

    if(route === 'email'){
      const to = /@[^ ]+\./.test(k.contact||'') ? k.contact.trim() : '';
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(text)}`;
      logSend(k, m, 'email');
    } else if(route === 'copy'){
      navigator.clipboard.writeText(text).then(()=>toast('Copied')).catch(()=>toast('Select and copy manually'));
      logSend(k, m, 'copy');
    } else if(route === 'download'){
      dl(`${slug(k.handle||'creator')}-${slug(m.subj)}.txt`, text, 'text/plain');
      logSend(k, m, 'download');
    } else {
      const r = SEND_ROUTES.find(x=>x.k===route);
      navigator.clipboard.writeText(text).catch(()=>{});
      window.open(r.url, '_blank', 'noopener');
      toast('Copied — paste it into ' + r.name);
      logSend(k, m, route);
    }
  };
}

function logSend(k, m, via){
  if(!k.handle) return;
  S.sendLog = S.sendLog || [];
  S.sendLog.push({ kol:k.handle, msg:m.name, via, at:new Date().toISOString() });
  const rec = S.kols.find(x=>x.handle===k.handle);
  if(rec && rec.stage === 'sourced') rec.stage = 'contacted';
  save(); renderKol();
}

/* ── playbook reference panel ── */
function renderPlaybook(){
  const box = el('playbook'); if(!box) return;
  box.innerHTML = `
    <div class="pb-gpm">
      <div class="pb-formula">
        <span class="pf-l">GPM</span>
        <b>(Total GMV ÷ Total views) × 1,000</b>
        <span class="pf-n">Sales efficiency, not reach. This is the number that decides a livestream fee.</span>
      </div>
      <div class="pb-bands">
        ${GPM_BANDS.slice().reverse().map(b => `<div class="pb-band">
          <span class="pill ${b.tone}">${b.label}</span>
          <b>${b.min?'$'+b.min+'+':'under $200'}</b>
          <span>${esc(b.note)}</span></div>`).join('')}
      </div>
    </div>

    <div class="pb-scen">
      ${FEE_SCENARIOS.filter(s=>s.k!=='s0').map(s => `<div class="pb-s">
        <div class="pbs-h"><span class="pill ${s.tone}">${esc(s.name)}</span>
          <span class="pbs-ticks">${s.min===s.max?s.min:s.min+'–'+s.max} ticks</span></div>
        <div class="pbs-fee">${S.settings.cur}${s.fee.toLocaleString()}<i> fixed + ${s.comm}%</i></div>
        <div class="pbs-be">Break-even GMV ${S.settings.cur}${breakEvenFor(s.fee).toLocaleString()}</div>
        <p>${esc(s.why)}</p></div>`).join('')}
    </div>

    <div class="pb-margin">
      <b>How break-even is worked out.</b> A fixed fee is recovered out of contribution margin, not out
      of the commission. These figures assume <b>${Math.round(BE_MARGIN*100)}c of contribution in every
      GMV dollar</b> after the ${FEE_SCENARIOS[0].comm}% creator commission — which is what the guide's
      published numbers resolve to. If the real margin on the bundle being sold is thinner, break-even
      rises and the fee stops being rational. Check it against the product before agreeing terms.
    </div>

    <div class="pb-rule">
      <b>Never skip these two.</b> Ingredient IQ and Real Skin are non-negotiable regardless of
      follower count. A creator who cannot explain the technology, or who films through heavy
      filtering, cannot sell a clinical product honestly — no audience size compensates for that.
      The console caps terms at commission-only when either is unticked.
    </div>`;
}

function renderLongTailPlan(){
  const box = el('longTailPlan'); if(!box) return;
  box.innerHTML = `<div class="tb-wrap"><table class="tb" id="longTailTable">
      <thead><tr><th>Platform</th><th>Role</th><th>M1-M2</th><th>M3-M4</th><th>M5-M6</th></tr></thead>
      <tbody>${LONG_TAIL_PLAN.map(p => `<tr>
        <td><b>${esc(p.channel)}</b></td>
        <td>${esc(p.role)}</td>
        <td>${esc(p.m12)}</td>
        <td>${esc(p.m34)}</td>
        <td>${esc(p.m56)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function renderKolPayments(){
  const box = el('kolPayments'); if(!box) return;
  const all = S.schedule || [];
  const totals = { unpaid:0, deposit:0, paid:0 };
  all.forEach(e => { totals[e.paidStatus||'unpaid'] += (e.feeAgreed||0); });
  const grand = totals.unpaid + totals.deposit + totals.paid;
  const c = S.settings.cur;
  box.innerHTML = `<div class="pay-summary">
    <div class="pay-tile"><span>Owed (unpaid)</span><b>${esc(c)}${totals.unpaid.toLocaleString()}</b></div>
    <div class="pay-tile"><span>Deposits paid</span><b>${esc(c)}${totals.deposit.toLocaleString()}</b></div>
    <div class="pay-tile"><span>Paid in full</span><b>${esc(c)}${totals.paid.toLocaleString()}</b></div>
    <div class="pay-tile tot"><span>Total committed</span><b>${esc(c)}${grand.toLocaleString()}</b></div>
  </div>`;
}

/* Real calendar dates for M1-M6, derived from S.settings.startMonth
   (previously unused anywhere) — needed to match schedule entries,
   which carry real dates, against a month index. */
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function monthDateRange(monthIndex){
  const parts = (S.settings.startMonth || 'July 2026').split(' ');
  const mi = MONTH_NAMES.indexOf(parts[0]);
  const yr = parseInt(parts[1], 10) || new Date().getFullYear();
  const base = mi >= 0 ? mi : 6;
  const start = new Date(Date.UTC(yr, base + monthIndex, 1));
  const end = new Date(Date.UTC(yr, base + monthIndex + 1, 1));
  return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) };
}

/* Connects the flat monthly KOL channel pool (Media plan) to the
   named creators actually committed against it this month. */
function kolBudgetDrilldown(monthIndex){
  const B = computeBudget();
  const b = B[monthIndex];
  const pool = (b && b.ch.kol) || 0;
  const range = monthDateRange(monthIndex);
  const entries = (S.schedule || []).filter(e => e.date >= range.start && e.date < range.end);
  const committed = entries.reduce((a,e) => a + (e.feeAgreed||0), 0);
  return { month: b ? b.label : '—', pool, committed, diff: pool - committed, entries };
}

function renderKolBudgetDrilldown(){
  const box = el('kolBudgetDrilldown'); if(!box) return;
  const i = Number.isInteger(S.mediaFocus) ? S.mediaFocus : 0;
  const d = kolBudgetDrilldown(i);
  const c = S.settings.cur;
  const over = d.diff < 0;
  box.innerHTML = `<div class="pay-summary">
      <div class="pay-tile"><span>${esc(d.month)} KOL budget</span><b>${esc(c)}${Math.round(d.pool).toLocaleString()}</b></div>
      <div class="pay-tile"><span>Committed to named creators</span><b>${esc(c)}${Math.round(d.committed).toLocaleString()}</b></div>
      <div class="pay-tile ${over?'over':'tot'}"><span>${over?'Over budget':'Headroom'}</span><b>${esc(c)}${Math.round(Math.abs(d.diff)).toLocaleString()}</b></div>
    </div>
    ${d.entries.length
      ? `<div class="tb-wrap"><table class="tb">
          <thead><tr><th>Creator</th><th>Deliverable</th><th class="n">Fee</th></tr></thead>
          <tbody>${d.entries.map(e => `<tr><td>${esc(e.kol)}</td><td>${esc(e.what)}</td><td class="n">${esc(c)}${(e.feeAgreed||0).toLocaleString()}</td></tr>`).join('')}</tbody>
        </table></div>`
      : `<p class="empty">No deliverables scheduled in ${esc(d.month)} yet.</p>`}`;
}

function renderKolActivation(){
  const box = el('kolActivation'); if(!box) return;
  const list = (S.kols || []).filter(k => ['approved','scheduled','live','done'].includes(k.stage));
  if(!list.length){
    box.innerHTML = `<p class="empty">No approved, scheduled, delivering, or complete creators yet. Move shortlisted creators forward to populate score, rating, GPM, ROAS and fit benchmarks here.</p>`;
    return;
  }

  const rows = list.map(k => {
    const gpm = computeGpm(k);
    const roas = creatorRoas(k);
    const rating = creatorRating(k);
    const kpi = k.type === 'live' ? 'GMV and conversion rate' : 'Review volume and CAC';
    return `<tr>
      <td><b>${esc(k.handle || '')}</b><span class="sub">${esc(k.type || 'ugc')} · ${esc(k.platform || '')}</span></td>
      <td class="n">${k.fee ? esc(S.settings.cur + k.fee) : '—'}</td>
      <td class="n">${gpm ? ('$' + Math.round(gpm).toLocaleString()) : '—'}</td>
      <td class="n">${roas ? roas.toFixed(1) + '×' : '—'}</td>
      <td class="n">${creatorScore(k)}/100</td>
      <td><span class="pill ${rating.tone}">${esc(rating.label)}</span></td>
      <td class="n">${fitScore(k)}/10</td>
      <td>${esc(kpi)}</td>
      <td>${esc((KOL_PIPE.find(x => x.k === k.stage) || {}).name || k.stage || '')}</td>
    </tr>`;
  }).join('');

  box.innerHTML = `<div class="tb-wrap"><table class="tb">
    <thead><tr><th>Creator</th><th class="n">Fee</th><th class="n">GPM</th><th class="n">ROAS</th><th class="n">Score</th><th>Rating</th><th class="n">Fit</th><th>KPI</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div><p class="fh">Score/rating/ROAS derive from verified roster fields only; blanks mean the source data is not recorded yet.</p>`;
}

/* Schedule Table/Board/Calendar toggle — static buttons, wired once. */
const schedViewTableBtn = el('schedViewTable');
const schedViewBoardBtn = el('schedViewBoard');
const schedViewCalBtn = el('schedViewCal');
function setSchedView(v){
  schedView = v;
  if(schedViewTableBtn) schedViewTableBtn.classList.toggle('on', v === 'table');
  if(schedViewBoardBtn) schedViewBoardBtn.classList.toggle('on', v === 'board');
  if(schedViewCalBtn) schedViewCalBtn.classList.toggle('on', v === 'cal');
  const t = el('kolSched'), b = el('kolSchedBoard'), c = el('kolSchedCal');
  if(t) t.hidden = v !== 'table';
  if(b) b.hidden = v !== 'board';
  if(c) c.hidden = v !== 'cal';
}
if(schedViewTableBtn) schedViewTableBtn.addEventListener('click', () => setSchedView('table'));
if(schedViewBoardBtn) schedViewBoardBtn.addEventListener('click', () => setSchedView('board'));
if(schedViewCalBtn) schedViewCalBtn.addEventListener('click', () => setSchedView('cal'));
