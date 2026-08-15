/* ════════════════════════════════════════════════
   Sessions · Sync · Export
   A session is a named snapshot of the whole plan.
   Sync is optional and uses a GitHub Gist the user
   owns — no server of ours sits in the middle.
   ════════════════════════════════════════════════ */

const SESS_KEY = 'dnuvo_sessions_v1';
const SYNC_KEY = 'dnuvo_sync_v1';
const LIVESYNC_KEY = 'dnuvo_livesync_v1';

// Live sync ships pre-configured with this passphrase so nobody has to open
// Sessions and paste a key by hand — same trust model as SITE_PASS/ADMIN_PASS
// in app.js (a shared team secret, plainly readable in this static site's
// source, not a real access-control boundary). This value MUST match
// WORKSPACE_KEY set in Netlify's site environment variables — change one,
// change the other. A browser only gets this default once, the first time
// it ever loads the app; if someone later clears the key or turns auto-push
// off from the Sessions drawer, that choice sticks and is never overwritten.
const DEFAULT_WORKSPACE_KEY = 'dnuvo2026';

let SESSIONS = [];
let SYNC = { token:'', gistId:'', lastPush:null, lastPull:null, auto:false };
let LIVESYNC = { key:'', lastPush:null, lastPull:null, auto:false };

function loadSessions(){
  try{ SESSIONS = JSON.parse(localStorage.getItem(SESS_KEY) || '[]'); }catch(e){ SESSIONS = []; }
  try{ SYNC = Object.assign(SYNC, JSON.parse(localStorage.getItem(SYNC_KEY) || '{}')); }catch(e){}
  const rawLiveSync = localStorage.getItem(LIVESYNC_KEY);
  try{ LIVESYNC = Object.assign(LIVESYNC, JSON.parse(rawLiveSync || '{}')); }catch(e){}
  if(rawLiveSync === null){
    // First time this browser has ever opened the app — turn Live sync on
    // by default instead of leaving it for someone to discover and configure.
    LIVESYNC.key = DEFAULT_WORKSPACE_KEY;
    LIVESYNC.auto = true;
    saveLiveSync();
  }
}
function saveSessions(){
  try{ localStorage.setItem(SESS_KEY, JSON.stringify(SESSIONS)); }catch(e){}
}
function saveSync(){
  try{ localStorage.setItem(SYNC_KEY, JSON.stringify(SYNC)); }catch(e){}
}
function saveLiveSync(){
  try{ localStorage.setItem(LIVESYNC_KEY, JSON.stringify(LIVESYNC)); }catch(e){}
}

/* ── snapshot helpers ── */
function snapshot(name, note){
  return {
    id: 'S' + Date.now().toString(36),
    name: name || ('Snapshot ' + new Date().toLocaleDateString()),
    note: note || '',
    at: new Date().toISOString(),
    by: role || 'team',
    data: JSON.parse(JSON.stringify(S))
  };
}
function sessionStats(sess){
  const d = sess.data || {};
  const months = d.months || [];
  const units = months.reduce((a,m)=>a+(+m.units||0),0);
  return {
    units,
    kols: (d.kols||[]).length,
    reqs: (d.requests||[]).filter(r=>r.status==='pending').length,
    gates: GATES.filter(g => ((d.gates||{})[g.id]||0) >= g.target).length
  };
}

/* ── GitHub Gist sync ────────────────────────────
   Uses the Gists API with a personal access token
   scoped to `gist` only. The token stays in this
   browser; it is never sent anywhere but GitHub.  */
const GH = 'https://api.github.com';

async function ghRequest(path, opts){
  if(!SYNC.token) throw new Error('No access token saved.');
  const r = await fetch(GH + path, Object.assign({
    headers: {
      'Authorization': 'Bearer ' + SYNC.token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }
  }, opts || {}));
  if(r.status === 401) throw new Error('GitHub rejected the token. Check it has gist access and has not expired.');
  if(r.status === 404) throw new Error('That gist could not be found. Check the ID, or create a new one.');
  if(!r.ok) throw new Error('GitHub returned ' + r.status + '. Try again in a moment.');
  return r.json();
}

function syncPayload(){
  return JSON.stringify({
    savedAt: new Date().toISOString(),
    brand: S.settings.brand,
    market: S.settings.market,
    current: S,
    sessions: SESSIONS
  }, null, 2);
}

async function ghPush(){
  const body = {
    description: `${S.settings.brand} launch console — ${S.settings.market} — ${new Date().toLocaleString()}`,
    files: { 'launch-console.json': { content: syncPayload() } }
  };
  let res;
  if(SYNC.gistId){
    res = await ghRequest('/gists/' + SYNC.gistId, { method:'PATCH', body: JSON.stringify(body) });
  } else {
    body.public = false;
    res = await ghRequest('/gists', { method:'POST', body: JSON.stringify(body) });
    SYNC.gistId = res.id;
  }
  SYNC.lastPush = new Date().toISOString();
  saveSync();
  return res;
}

async function ghPull(){
  if(!SYNC.gistId) throw new Error('No gist ID saved. Push once first, or paste an existing ID.');
  const res = await ghRequest('/gists/' + SYNC.gistId);
  const file = res.files && res.files['launch-console.json'];
  if(!file) throw new Error('That gist has no launch-console.json file in it.');
  let content = file.content;
  if(file.truncated && file.raw_url){
    content = await (await fetch(file.raw_url)).text();
  }
  const parsed = JSON.parse(content);
  if(!parsed.current) throw new Error('That file is not a launch console backup.');
  SYNC.lastPull = new Date().toISOString();
  saveSync();
  return parsed;
}

/* ── Live sync ───────────────────────────────────
   One shared blob on Netlify, protected by a single
   workspace passphrase (not a per-user account). Whole-
   plan fields (pricing, budget, settings) are still
   last-write-wins — there is no merge logic there, so two
   people editing the price book at once means whoever
   pushes last wins. The creator roster and its schedule
   are the one part of the plan meant to be added to by
   everyone constantly, so those two lists get a real
   merge instead (see mergeById below): a push accumulates
   additions from both sides rather than overwriting.
   This is also what lets a team member's proposal actually
   reach the admin's browser without a manual handoff.    */
const LIVESYNC_URL = '/.netlify/functions/sync';

/* Merge two id-keyed lists (KOL roster or schedule) plus their tombstones.
   - An id present on only one side survives — an addition never gets wiped
     out by the other side's push, which is what "the list accumulates"
     requires under last-write-wins.
   - An id present on both sides keeps whichever copy has the newer
     updatedAt — an edit wins over a stale copy of the same record.
   - A delete is a tombstone {id, at}, not just an absence — without it, a
     delete would look identical to "never seen this id," and the next
     push from a browser that still has the old record would resurrect it.
     A tombstone wins over the record on the other side unless that other
     copy has a *newer* updatedAt than the delete — i.e. a genuine edit
     made after the delete un-deletes it, rather than a delete staying
     permanently unresolvable against a browser that never got the memo. */
function mergeById(localList, remoteList, localTombstones, remoteTombstones){
  const tomb = new Map();
  (localTombstones||[]).concat(remoteTombstones||[]).forEach(t => {
    if(!t || !t.id) return;
    const cur = tomb.get(t.id);
    if(!cur || t.at > cur.at) tomb.set(t.id, t);
  });
  const rec = new Map();
  (localList||[]).concat(remoteList||[]).forEach(r => {
    if(!r || !r.id) return;
    const cur = rec.get(r.id);
    if(!cur || (r.updatedAt||'') > (cur.updatedAt||'')) rec.set(r.id, r);
  });
  const list = [];
  rec.forEach((r, id) => {
    const t = tomb.get(id);
    if(t && t.at >= (r.updatedAt||'')) return; // delete wins over a stale-or-equal copy
    list.push(r);
  });
  const tombstones = [...tomb.values()].sort((a,b) => b.at.localeCompare(a.at)).slice(0, 500);
  return { list, tombstones };
}

/* Merges the shared workspace's roster/schedule into S in place — used by
   both push (merge before writing back) and pull (merge before adopting
   remote's other fields), so neither direction can drop a record the other
   browser added or silently resurrect one it deleted. */
function mergeRosterFrom(remoteCurrent){
  if(!remoteCurrent) return;
  const kolsMerge = mergeById(S.kols, remoteCurrent.kols, S.kolTombstones, remoteCurrent.kolTombstones);
  const schedMerge = mergeById(S.schedule, remoteCurrent.schedule, S.scheduleTombstones, remoteCurrent.scheduleTombstones);
  const contentMerge = mergeById(S.content, remoteCurrent.content, S.contentTombstones, remoteCurrent.contentTombstones);
  S.kols = kolsMerge.list; S.kolTombstones = kolsMerge.tombstones;
  S.schedule = schedMerge.list; S.scheduleTombstones = schedMerge.tombstones;
  S.content = contentMerge.list; S.contentTombstones = contentMerge.tombstones;
}

/* Adopting a pulled workspace normally means "replace S with remote" — fine
   for pricing/budget/settings, which are meant to have one owner at a time.
   The roster and its schedule are the exception: everyone adds to those
   continuously, so replacing wholesale would drop whatever this browser
   added since its last pull. Merge those two lists first, then let remote
   win on everything else, same as before. */
function applyRemoteMergedState(remoteCurrent){
  mergeRosterFrom(remoteCurrent);
  const mergedKols = S.kols, mergedKolTomb = S.kolTombstones;
  const mergedSched = S.schedule, mergedSchedTomb = S.scheduleTombstones;
  const mergedContent = S.content, mergedContentTomb = S.contentTombstones;
  S = normalizeState(Object.assign({}, remoteCurrent));
  S.kols = mergedKols; S.kolTombstones = mergedKolTomb;
  S.schedule = mergedSched; S.scheduleTombstones = mergedSchedTomb;
  S.content = mergedContent; S.contentTombstones = mergedContentTomb;
  return S;
}

async function liveSyncPush(){
  if(!LIVESYNC.key) throw new Error('No workspace key saved.');

  // Pull-merge-push: fold in whatever's already on the shared workspace
  // before overwriting it, so this push accumulates roster/schedule changes
  // instead of erasing something a teammate pushed since our last pull.
  // Best-effort — a failed pre-merge fetch (offline, nothing pushed yet)
  // just falls through to pushing the local state as-is.
  try{
    const r = await fetch(LIVESYNC_URL, { headers: { 'X-Workspace-Key': LIVESYNC.key } });
    if(r.ok){
      const remote = await r.json();
      if(remote && remote.current){
        mergeRosterFrom(remote.current);
        save();
      }
    }
  }catch(e){ /* offline, or nothing pushed yet — push local state as-is */ }

  const r = await fetch(LIVESYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Workspace-Key': LIVESYNC.key },
    body: JSON.stringify({ savedAt: new Date().toISOString(), current: S, sessions: SESSIONS })
  });
  if(r.status === 401) throw new Error('That workspace key was rejected. Check it against what is set in Netlify.');
  if(r.status === 500) throw new Error('Live sync is not set up on this deploy yet — WORKSPACE_KEY is missing in Netlify site settings.');
  if(!r.ok) throw new Error('Live sync returned ' + r.status + '. Try again in a moment.');
  LIVESYNC.lastPush = new Date().toISOString();
  saveLiveSync();
  return r.json();
}

async function liveSyncPull(){
  if(!LIVESYNC.key) throw new Error('No workspace key saved.');
  const r = await fetch(LIVESYNC_URL, { headers: { 'X-Workspace-Key': LIVESYNC.key } });
  if(!r.ok) throw new Error('Live sync returned ' + r.status + '. Try again in a moment.');
  const parsed = await r.json();
  if(!parsed.current) throw new Error('Nothing has been pushed to this workspace yet.');
  LIVESYNC.lastPull = new Date().toISOString();
  saveLiveSync();
  return parsed;
}

/* Runs once per app open, only if Live sync is already configured — nothing
   changes for anyone who hasn't set a workspace key. Goal: a browser that
   was just left open, or opened fresh, shouldn't show data that's gone
   stale because nobody remembered to click Pull. Safe to fail quietly —
   the real error still shows up if the user pulls manually from the
   Sessions drawer. Never overwrites local work the workspace hasn't seen
   yet; that case is handed to the user instead of guessed at. */
async function liveSyncAutoPullOnBoot(){
  if(!LIVESYNC.key) return;
  // A record editor (kolForm, fitForm, ...) holds an array index captured
  // when it opened; replacing S while one is open risks that index landing
  // on a different record once the array's rebuilt. Wait for it to close.
  if(el('modal') && !el('modal').hidden) return;
  const prevLastPull = LIVESYNC.lastPull;
  let d;
  try{ d = await liveSyncPull(); }
  catch(e){ return; }

  const workspaceIsNewer = !prevLastPull || d.savedAt > prevLastPull;
  if(!workspaceIsNewer) return;

  const localEdit = lastLocalEditAt();
  const hasUnpushedLocalWork = !!localEdit && (!LIVESYNC.lastPush || localEdit > LIVESYNC.lastPush);

  if(!hasUnpushedLocalWork){
    S = applyRemoteMergedState(d.current); SESSIONS = d.sessions || SESSIONS;
    save(); saveSessions(); renderAll(); renderKol();
    if(typeof renderLiveSyncPane === 'function' && el('liveSyncPane')) renderLiveSyncPane();
    toast('Synced with the latest shared workspace data');
    return;
  }

  modal('Newer data on the shared workspace', `<p style="font-size:13.5px;color:var(--mute);line-height:1.6">
    This browser has changes that were never pushed, and the shared workspace was last saved
    <b style="color:var(--ink)">${esc(new Date(d.savedAt).toLocaleString())}</b>.</p>
    <p style="font-size:13px;color:var(--mute);margin-top:10px">
    The creator roster and schedule merge automatically either way — nothing added on either side
    gets lost. This choice only decides which copy wins for everything else (pricing, budget,
    settings). If unsure, keep your local changes and push them from Sessions → Live sync once
    you've confirmed they're the right ones.</p>`,
    [['Keep my local changes','x'],['Use the shared workspace','ok']], a => {
      if(a !== 'ok'){
        // Even "keep local" still folds in the shared roster/schedule —
        // that part isn't part of the conflict, only pricing/budget/settings is.
        mergeRosterFrom(d.current); save(); renderKol();
        return true;
      }
      S = applyRemoteMergedState(d.current); SESSIONS = d.sessions || SESSIONS;
      save(); saveSessions(); renderAll(); renderKol();
      toast('Loaded the latest shared workspace data');
      return true;
    });
}

/* ── exporters ───────────────────────────────────
   Each section can leave as JSON, CSV or Markdown. */

function dl(filename, text, mime){
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const stamp = () => new Date().toISOString().slice(0,10);

function toCSV(rows){
  return rows.map(r => r.map(c => {
    const v = c == null ? '' : String(c);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
  }).join(',')).join('\n');
}
function toMD(title, rows, intro){
  if(!rows.length) return `# ${title}\n\n_No data._\n`;
  const head = rows[0], body = rows.slice(1);
  let md = `# ${title}\n\n`;
  if(intro) md += intro + '\n\n';
  md += '| ' + head.join(' | ') + ' |\n';
  md += '| ' + head.map(()=>'---').join(' | ') + ' |\n';
  body.forEach(r => md += '| ' + r.map(c => String(c==null?'':c).replace(/\|/g,'\\|')).join(' | ') + ' |\n');
  return md;
}

/* Build the row matrix for any section. Respects the
   cost boundary — team exports never carry cost.     */
function sectionRows(sec){
  const B = computeBudget();
  const c = S.settings.cur;
  const admin = isAdmin();

  switch(sec){
    case 'pricing': {
      const head = ['Product','Spec','Tier','MSRP','Sale']
        .concat(admin ? ['Cost'] : [])
        .concat(['Floor','Max discount %','Role','Units']);
      const rows = S.skus.map(s => [s.name, s.spec, s.tier, c+s.msrp, c+s.sale]
        .concat(admin ? [c+s.cogs] : [])
        .concat([c+floorOf(s).toFixed(2), maxDiscount(s), s.role, s.units]));
      return [head, ...rows];
    }
    case 'bundles': {
      const head = ['Bundle','Contents','Tier','Price','Sum of parts','Saving %','Used for'];
      const rows = BUNDLES.map(b => {
        const parts = b.parts.map(p=>S.skus.find(s=>s.id===p)).filter(Boolean);
        const sum = parts.reduce((a,s)=>a+s.sale,0);
        return [b.name, parts.map(p=>p.name).join(' + '), b.tier, c+b.price, c+sum,
                sum?Math.round((1-b.price/sum)*100):0, b.stage];
      });
      return [head, ...rows];
    }
    case 'media': {
      const chK = Object.keys(CHAN_META);
      const head = ['Month','Units','Avg price','Revenue']
        .concat(admin?['Gross profit']:[])
        .concat(['Media budget'], chK.map(k=>CHAN_META[k].name));
      const rows = B.map(b => [b.label, b.units, c+b.price, c+Math.round(b.rev)]
        .concat(admin?[c+Math.round(b.profit)]:[])
        .concat([c+Math.round(b.budget)], chK.map(k=>b.ch[k]?c+Math.round(b.ch[k]):'—')));
      rows.push(['TOTAL', B.reduce((a,b)=>a+b.units,0), '—', c+Math.round(B.reduce((a,b)=>a+b.rev,0))]
        .concat(admin?[c+Math.round(B.reduce((a,b)=>a+b.profit,0))]:[])
        .concat([c+Math.round(B.reduce((a,b)=>a+b.budget,0))],
                chK.map(k=>c+Math.round(B.reduce((a,b)=>a+(b.ch[k]||0),0)))));
      return [head, ...rows];
    }
    case 'alloc': {
      const head = ['Month','Channel','Product or bundle','Format','Success measure','Budget','Share %'];
      const rows = [];
      B.forEach(b => {
        Object.keys(ALLOC).forEach(ck => {
          const spend = b.ch[ck]||0; if(spend<=0) return;
          const tot = spend;
          ALLOC[ck].forEach(a => rows.push([b.label, CHAN_META[ck].name, a.label, a.fmt, a.kpi,
            c+Math.round(spend*a.w), Math.round(a.w*100)]));
        });
      });
      return [head, ...rows];
    }
    case 'kol': {
      // Fee/rate/commission are real committed spend — kept out of team
      // exports the same way SKU cost is, even though the live roster view
      // (a KOL manager needs these to actually negotiate) shows them unmasked.
      const head = ['Handle','Name','Platform','Tier','Followers','Engagement %','Posts','GMV','Audience','Contact','Stage','Source','Notes']
        .concat(admin ? ['Rate','Fee','Commission','Payment terms'] : []);
      const rows = S.kols.map(k => [k.handle,k.name,k.platform,k.tier,
        k.followers||'NOT VERIFIED', k.er||'NOT VERIFIED', k.posts||'NOT VERIFIED',
        k.gmv||'NOT VERIFIED', k.audience||'NOT VERIFIED', k.contact||'NOT VERIFIED',
        (KOL_PIPE.find(s=>s.k===k.stage)||{}).name||k.stage, k.source||'', k.notes||'']
        .concat(admin ? [k.rate?c+k.rate:'', k.fee?c+k.fee:'', k.commission||'', k.paymentTerms||''] : []));
      return [head, ...rows];
    }
    case 'kolschedule': {
      const head = ['Date','Time','Creator','Type','Deliverable','Owner','Notes','Proof link','Status','Payment status']
        .concat(admin ? ['Fee'] : []);
      const rows = (S.schedule||[]).slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(e => {
        const status = e.done ? 'Done' : (e.date < stamp() ? 'Overdue' : 'Booked');
        return [e.date, e.time||'', e.kol, e.type, e.what, e.owner||'', e.note||'', e.proofLink||'', status, e.paidStatus||'unpaid']
          .concat(admin ? [e.feeAgreed?c+e.feeAgreed:''] : []);
      });
      return [head, ...rows];
    }
    case 'brandpulse': {
      const audit = S.siteAudit || SITE_AUDIT_TEMPLATE;
      const chNames = { shopee:'Shopee', tiktok:'TikTok', shopify:'Shopify' };
      const auditRows = Object.keys(SITE_AUDIT_TEMPLATE).map(k => {
        const a = audit[k] || SITE_AUDIT_TEMPLATE[k];
        return [chNames[k]||k, a.score, a.issue||'', a.recommendation||''];
      });
      const fit = S.personaFit || { awareness:3, conversion:3, retention:3 };
      const fitScore = p => {
        const ch = p.channels || [];
        const coverage = ch.filter(x => /Shopee|TikTok|Shopify|Lazada|Retail|Instagram/i.test(x)).length;
        return Math.max(1, Math.min(5, Math.round((fit.awareness+fit.conversion+fit.retention+coverage)/4)));
      };
      const head = ['Section','Item','Score /5','Detail'];
      const rows = [
        ...auditRows.map(r => ['Site audit', r[0], r[1], [r[2],r[3]].filter(Boolean).join(' — ')]),
        ...BUYER_PERSONAS.map(p => ['Buyer persona', p.name, fitScore(p), p.pain])
      ];
      return [head, ...rows];
    }
    case 'sendlog': {
      return [['Date','Creator','Message','Sent via'],
        ...(S.sendLog||[]).map(s=>[new Date(s.at).toLocaleString(), s.kol, s.msg, s.via])];
    }
    case 'shoplinks': {
      return [['Product','Handle','URL','Link status'],
        ...S.skus.map(s=>[s.name, s.handle||'', s.url||'', s.urlOk===true?'OK':s.urlOk===false?'Broken':'Not checked'])];
    }
    case 'compintel': {
      const src = (S.compIntel && S.compIntel.length) ? S.compIntel : COMPETITOR_INTEL;
      const head = ['Competitor','Product','Product type','Channel','Currency','List price','Promo price','Observed at','Key message','Source'];
      const rows = src.map(r => [
        r.competitor, r.product, r.productType, r.channel, r.currency,
        r.listPrice || '', r.promoPrice || '', r.observedAt, r.keyMessage, r.source
      ]);
      return [head, ...rows];
    }
    case 'calendar': {
      const head = ['Month','Media','Creators','Activity','Promotion','Units','Budget'];
      const rows = MONTHS.map((m,i)=>[m.label,m.media,m.kolWork,m.events,m.promo,
        B[i].units, c+Math.round(B[i].budget)]);
      return [head, ...rows];
    }
    case 'events': {
      return [['Activity','When','Budget','Purpose','How it runs','Owner'],
        ...EVENTS.map(e=>[e.name,e.when,e.budget,e.goal,e.how,e.owner])];
    }
    case 'weeks': {
      const head = ['Week','Focus','Owner','Task','Done'];
      const rows = [];
      WEEKS.forEach((w,wi)=>w.items.forEach((it,ii)=>
        rows.push([w.n,w.t,w.owner,it, S.checks[`w${wi}_${ii}`]?'yes':'no'])));
      return [head, ...rows];
    }
    case 'report': {
      const head = ['Month','Units plan','Units actual','Revenue plan','Revenue actual','Return','Reviews','Rating'];
      const rows = B.map(b=>{ const a=S.actuals[b.k]||{};
        return [b.label,b.units,a.units||'',c+Math.round(b.rev),a.rev||'',a.roas||'',a.reviews||'',a.rating||'']; });
      return [head, ...rows];
    }
    case 'gates': {
      return [['Gate','Current','Target','Unit','Unlocks','Status','Why it exists'],
        ...GATES.map(g=>{ const cu=S.gates[g.id]||0;
          return [g.label, g.id==='rating'?cu.toFixed(1):Math.round(cu), g.target, g.unit,
                  g.unlocks, cu>=g.target?'OPEN':'LOCKED', g.why]; })];
    }
    case 'approvals': {
      return [['Date','Status','Area','Field','From','To','Reason'],
        ...S.requests.map(r=>[new Date(r.at).toLocaleDateString(), r.status, r.area, r.field,
          r.from, r.to, r.why])];
    }
    case 'strategy': {
      return [['Phase','Months','Focus','What happens','Return target','Gate to next'],
        ...PHASES.map(p=>[`Phase ${p.n} — ${p.name}`,p.months,p.focus,p.doing,p.roas,p.gate])];
    }
    case 'expansion': {
      const head = ['Candidate','Market','Contact','Status','Notes'];
      const rows = (S.expansion.distributors||[]).map(d => {
        const marketName = (EXPANSION_MARKETS.find(m=>m.k===d.market)||{}).name || d.market;
        return [d.name||'', marketName, d.contact||'', d.status||'', d.notes||''];
      });
      return [head, ...rows];
    }
    default: return [['No data']];
  }
}

const SECTION_LABELS = {
  strategy:'Strategy and phases', pricing:'Price book', bundles:'Bundles',
  media:'Media budget', alloc:'Allocation by product', kol:'Creator roster',
  kolschedule:'Creator schedule and deliverables',
  compintel:'Competitor intelligence', brandpulse:'Brand pulse — site audit and personas',
  calendar:'Six-month calendar', events:'Activities', weeks:'First eight weeks',
  report:'Reporting actuals', gates:'Launch gates', approvals:'Requests and flags',
  sendlog:'Creator outreach log', shoplinks:'Shop link status', expansion:'MY/TH expansion candidates'
};

function exportSection(sec, fmt){
  const rows = sectionRows(sec);
  const label = SECTION_LABELS[sec] || sec;
  const base = `${slug(S.settings.brand)}-${slug(label)}-${stamp()}`;
  if(fmt === 'csv') dl(base + '.csv', toCSV(rows), 'text/csv;charset=utf-8');
  else if(fmt === 'md') dl(base + '.md', toMD(`${S.settings.brand} — ${label}`, rows,
    `${S.settings.market} · exported ${new Date().toLocaleDateString()}`), 'text/markdown');
  else dl(base + '.json', JSON.stringify({
    brand:S.settings.brand, market:S.settings.market, section:label,
    exportedAt:new Date().toISOString(), columns:rows[0], rows:rows.slice(1)
  }, null, 2), 'application/json');
  toast(`${label} downloaded as ${fmt.toUpperCase()}`);
}

function exportEverything(fmt){
  const secs = Object.keys(SECTION_LABELS);
  if(fmt === 'md'){
    let md = `# ${S.settings.brand} — Launch Plan\n\n`;
    md += `**Market** ${S.settings.market}  \n**Exported** ${new Date().toLocaleString()}  \n`;
    md += `**Access level** ${isAdmin()?'Administrator':'Team member'}\n\n`;
    if(!isAdmin()) md += `> Cost figures are not included at this access level.\n\n`;
    md += `---\n\n`;
    secs.forEach(s => {
      md += toMD(SECTION_LABELS[s], sectionRows(s)).replace(/^# /,'## ') + '\n';
    });
    dl(`${slug(S.settings.brand)}-full-plan-${stamp()}.md`, md, 'text/markdown');
  } else {
    const out = { brand:S.settings.brand, market:S.settings.market,
      exportedAt:new Date().toISOString(), access:isAdmin()?'admin':'team', sections:{} };
    secs.forEach(s => { const r = sectionRows(s); out.sections[SECTION_LABELS[s]] = { columns:r[0], rows:r.slice(1) }; });
    dl(`${slug(S.settings.brand)}-full-plan-${stamp()}.json`, JSON.stringify(out,null,2), 'application/json');
  }
  toast('Full plan downloaded');
}
