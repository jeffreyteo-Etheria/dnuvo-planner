/* ════════════════════════════════════════════════
   Sessions · Sync · Export
   A session is a named snapshot of the whole plan.
   Sync is optional and uses a GitHub Gist the user
   owns — no server of ours sits in the middle.
   ════════════════════════════════════════════════ */

const SESS_KEY = 'dnuvo_sessions_v1';
const SYNC_KEY = 'dnuvo_sync_v1';

let SESSIONS = [];
let SYNC = { token:'', gistId:'', lastPush:null, lastPull:null, auto:false };

function loadSessions(){
  try{ SESSIONS = JSON.parse(localStorage.getItem(SESS_KEY) || '[]'); }catch(e){ SESSIONS = []; }
  try{ SYNC = Object.assign(SYNC, JSON.parse(localStorage.getItem(SYNC_KEY) || '{}')); }catch(e){}
}
function saveSessions(){
  try{ localStorage.setItem(SESS_KEY, JSON.stringify(SESSIONS)); }catch(e){}
}
function saveSync(){
  try{ localStorage.setItem(SYNC_KEY, JSON.stringify(SYNC)); }catch(e){}
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
      const head = ['Handle','Name','Platform','Tier','Followers','Engagement %','Posts','GMV','Audience','Contact','Stage','Source','Notes'];
      const rows = S.kols.map(k => [k.handle,k.name,k.platform,k.tier,
        k.followers||'NOT VERIFIED', k.er||'NOT VERIFIED', k.posts||'NOT VERIFIED',
        k.gmv||'NOT VERIFIED', k.audience||'NOT VERIFIED', k.contact||'NOT VERIFIED',
        (KOL_STAGES.find(s=>s.k===k.stage)||{}).name||k.stage, k.source||'', k.notes||'']);
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
    default: return [['No data']];
  }
}

const SECTION_LABELS = {
  strategy:'Strategy and phases', pricing:'Price book', bundles:'Bundles',
  media:'Media budget', alloc:'Allocation by product', kol:'Creator roster',
  calendar:'Six-month calendar', events:'Activities', weeks:'First eight weeks',
  report:'Reporting actuals', gates:'Launch gates', approvals:'Change requests'
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
