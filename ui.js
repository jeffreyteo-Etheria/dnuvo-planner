/* ════════════════════════════════════════════════
   Console UI — sessions drawer, sync, exports,
   command palette, sortable tables, shortcuts
   ════════════════════════════════════════════════ */

/* ── DRAWER ── */
function openDrawer(tab){
  el('drawer').hidden = false;
  requestAnimationFrame(()=>el('drawer').classList.add('on'));
  drawerTab(tab || 'sessions');
}
function closeDrawer(){
  el('drawer').classList.remove('on');
  setTimeout(()=>el('drawer').hidden = true, 220);
}
function drawerTab(t){
  qsa('.dw-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  qsa('.dw-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === t));
  if(t === 'sessions') renderSessions();
  if(t === 'sync')     renderSync();
  if(t === 'export')   renderExport();
}

/* ── SESSIONS ── */
function renderSessions(){
  const box = el('sessList');
  if(!SESSIONS.length){
    box.innerHTML = `<div class="dw-empty">
      <b>No saved sessions yet</b>
      <p>A session is a full snapshot of the plan — pricing, budget, creators, approvals and progress. Save one before a big change so you can always come back to it.</p>
      <button class="btn-solid" onclick="newSession()">Save the current plan</button></div>`;
    return;
  }
  box.innerHTML = SESSIONS.slice().reverse().map(s => {
    const st = sessionStats(s);
    const d = new Date(s.at);
    return `<div class="sess">
      <div class="sess-h">
        <b>${esc(s.name)}</b>
        <span class="pill ${s.by==='admin'?'p-v':'p-n'}">${s.by==='admin'?'Admin':'Team'}</span>
        <span class="sess-when">${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      </div>
      ${s.note?`<p class="sess-note">${esc(s.note)}</p>`:''}
      <div class="sess-stats">
        <span><b>${st.units.toLocaleString()}</b> units</span>
        <span><b>${st.kols}</b> creators</span>
        <span><b>${st.gates}/5</b> gates</span>
        ${st.reqs?`<span class="warn"><b>${st.reqs}</b> pending</span>`:''}
      </div>
      <div class="sess-a">
        <button class="btn-line sm" data-load="${s.id}">Restore</button>
        <button class="btn-line sm" data-dup="${s.id}">Duplicate</button>
        <button class="btn-line sm" data-dlsess="${s.id}">Download</button>
        <button class="btn-line sm danger" data-delsess="${s.id}">Delete</button>
      </div></div>`;
  }).join('');

  qsa('[data-load]').forEach(b => b.addEventListener('click', () => {
    const s = SESSIONS.find(x=>x.id===b.dataset.load);
    modal('Restore this session?', `<p style="font-size:13.5px;line-height:1.6;color:var(--mute)">
      Restoring <b style="color:var(--ink)">${esc(s.name)}</b> replaces everything currently in the console —
      pricing, budget, creators, approvals and progress.</p>
      <p style="font-size:13px;color:var(--mute);margin-top:10px">Your current plan is not saved automatically.
      Save it as a session first if you want to come back to it.</p>`,
      [['Cancel','x'],['Save current, then restore','both'],['Restore','ok']], a => {
        if(a==='x') return true;
        if(a==='both'){
          SESSIONS.push(snapshot('Before restoring ' + s.name, 'Auto-saved'));
          saveSessions();
        }
        S = JSON.parse(JSON.stringify(s.data));
        save(); renderAll(); renderKol(); renderSessions();
        toast('Session restored');
        return true;
      });
  }));
  qsa('[data-dup]').forEach(b => b.addEventListener('click', () => {
    const s = SESSIONS.find(x=>x.id===b.dataset.dup);
    const c = JSON.parse(JSON.stringify(s));
    c.id = 'S'+Date.now().toString(36); c.name = s.name + ' (copy)'; c.at = new Date().toISOString();
    SESSIONS.push(c); saveSessions(); renderSessions(); toast('Session duplicated');
  }));
  qsa('[data-dlsess]').forEach(b => b.addEventListener('click', () => {
    const s = SESSIONS.find(x=>x.id===b.dataset.dlsess);
    dl(`${slug(s.name)}-${stamp()}.json`, JSON.stringify(s,null,2), 'application/json');
    toast('Session downloaded');
  }));
  qsa('[data-delsess]').forEach(b => b.addEventListener('click', () => {
    const s = SESSIONS.find(x=>x.id===b.dataset.delsess);
    modal('Delete this session?', `<p style="font-size:13.5px;color:var(--mute)">
      <b style="color:var(--ink)">${esc(s.name)}</b> will be removed. This cannot be undone.</p>`,
      [['Keep it','x'],['Delete','ok']], a => {
        if(a!=='ok') return true;
        SESSIONS = SESSIONS.filter(x=>x.id!==s.id);
        saveSessions(); renderSessions(); toast('Session deleted');
        return true;
      });
  }));
}

function newSession(){
  modal('Save a session', `
    <div class="mf"><label>Name</label>
      <input id="sName" value="${esc('Plan — ' + new Date().toLocaleDateString())}"></div>
    <div class="mf"><label>What changed</label>
      <textarea id="sNote" rows="3" placeholder="Optional. What is different about this version?"></textarea>
      <p class="fh">Snapshots everything: pricing, budget, creators, approvals, progress and notes.</p></div>`,
    [['Cancel','x'],['Save session','ok']], a => {
      if(a!=='ok') return true;
      SESSIONS.push(snapshot(el('sName').value.trim(), el('sNote').value.trim()));
      saveSessions(); renderSessions(); toast('Session saved');
      return true;
    });
}

function importSession(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = () => {
    const f = inp.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => {
      try{
        const d = JSON.parse(r.result);
        if(d.data && d.name){ d.id = 'S'+Date.now().toString(36); SESSIONS.push(d); }
        else if(d.settings || d.months){ SESSIONS.push(snapshot('Imported ' + f.name.replace('.json',''), 'From file')); SESSIONS[SESSIONS.length-1].data = d; }
        else throw 0;
        saveSessions(); renderSessions(); toast('Session imported');
      }catch(e){ toast('That file is not a session backup'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

/* ── SYNC ── */
function renderSync(){
  const connected = !!(SYNC.token && SYNC.gistId);
  el('syncPane').innerHTML = `
    <div class="sync-state ${connected?'ok':''}">
      <span class="ss-dot"></span>
      <div><b>${connected?'Connected to GitHub':'Not connected'}</b>
        <span>${connected
          ? 'Gist ' + esc(SYNC.gistId.slice(0,10)) + '…'
          : 'Save the plan to a private gist you own'}</span></div>
    </div>

    <div class="mf"><label>Personal access token</label>
      <input id="ghTok" type="password" value="${esc(SYNC.token)}" placeholder="ghp_…">
      <p class="fh">Create one at <b>github.com → Settings → Developer settings → Tokens (classic)</b>
        with only the <b>gist</b> scope ticked. It stays in this browser and is sent only to GitHub.</p></div>

    <div class="mf"><label>Gist ID <span style="text-transform:none;letter-spacing:0;color:var(--faint)">— leave blank to create a new one</span></label>
      <input id="ghGist" value="${esc(SYNC.gistId)}" placeholder="created automatically on first push"></div>

    <label class="sync-auto"><input type="checkbox" id="ghAuto"${SYNC.auto?' checked':''}>
      <span>Push automatically when I save a session</span></label>

    <div class="sync-acts">
      <button class="btn-solid" id="ghPushBtn">Push to GitHub</button>
      <button class="btn-line" id="ghPullBtn">Pull from GitHub</button>
      <button class="btn-line" id="ghOpenBtn"${SYNC.gistId?'':' disabled'}>Open gist</button>
    </div>

    <div class="sync-log">
      <div><span>Last push</span><b>${SYNC.lastPush?new Date(SYNC.lastPush).toLocaleString():'never'}</b></div>
      <div><span>Last pull</span><b>${SYNC.lastPull?new Date(SYNC.lastPull).toLocaleString():'never'}</b></div>
      <div><span>Sessions stored</span><b>${SESSIONS.length}</b></div>
    </div>

    <div class="sync-note">
      A gist is a small private file on your GitHub account. It holds the current plan plus every
      saved session, so the same work opens on another machine. Anyone you share the gist with can
      read whatever is in it — including cost figures. Keep it private.
    </div>`;

  el('ghTok').addEventListener('input', e => { SYNC.token = e.target.value.trim(); saveSync(); });
  el('ghGist').addEventListener('input', e => { SYNC.gistId = e.target.value.trim(); saveSync(); });
  el('ghAuto').addEventListener('change', e => { SYNC.auto = e.target.checked; saveSync(); });

  el('ghPushBtn').addEventListener('click', async () => {
    const b = el('ghPushBtn'); b.disabled = true; b.textContent = 'Pushing…';
    try{
      const res = await ghPush();
      toast('Pushed to GitHub');
      renderSync();
      if(res.html_url) SYNC._url = res.html_url;
    }catch(e){ toast(e.message); b.disabled = false; b.textContent = 'Push to GitHub'; }
  });

  el('ghPullBtn').addEventListener('click', async () => {
    const b = el('ghPullBtn'); b.disabled = true; b.textContent = 'Pulling…';
    try{
      const d = await ghPull();
      modal('Replace local plan?', `<p style="font-size:13.5px;color:var(--mute);line-height:1.6">
        The gist was last saved <b style="color:var(--ink)">${esc(new Date(d.savedAt).toLocaleString())}</b>
        and holds <b style="color:var(--ink)">${(d.sessions||[]).length}</b> session(s).</p>
        <p style="font-size:13px;color:var(--mute);margin-top:10px">
        Pulling replaces what is in this browser. Save a session first if you have unsaved work.</p>`,
        [['Cancel','x'],['Pull and replace','ok']], a => {
          if(a!=='ok') return true;
          S = d.current; SESSIONS = d.sessions || [];
          save(); saveSessions(); renderAll(); renderKol(); renderSync(); renderSessions();
          toast('Pulled from GitHub');
          return true;
        });
    }catch(e){ toast(e.message); }
    b.disabled = false; b.textContent = 'Pull from GitHub';
  });

  el('ghOpenBtn').addEventListener('click', () => {
    if(SYNC.gistId) window.open('https://gist.github.com/' + SYNC.gistId, '_blank', 'noopener');
  });
}

/* ── EXPORT ── */
function renderExport(){
  el('exportPane').innerHTML = `
    <div class="ex-all">
      <div><b>Everything</b><span>All sections in one file</span></div>
      <div class="ex-btns">
        <button class="btn-line sm" data-all="md">Markdown</button>
        <button class="btn-line sm" data-all="json">JSON</button>
      </div>
    </div>
    ${!isAdmin()?`<div class="ex-warn">Cost figures are not included in exports at your access level.</div>`:''}
    <div class="ex-list">
      ${Object.keys(SECTION_LABELS).map(k => `
        <div class="ex-row">
          <span>${esc(SECTION_LABELS[k])}</span>
          <div class="ex-btns">
            <button class="btn-line sm" data-ex="${k}" data-fmt="csv">CSV</button>
            <button class="btn-line sm" data-ex="${k}" data-fmt="md">MD</button>
            <button class="btn-line sm" data-ex="${k}" data-fmt="json">JSON</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="ex-note">
      CSV opens in a spreadsheet. Markdown pastes into Notion, Docs or a slide deck.
      JSON is for feeding another tool. To make slides, use <b>Export view</b> in the header instead —
      it prints the section you are looking at at slide proportions.
    </div>`;

  qsa('[data-ex]').forEach(b => b.addEventListener('click', () => exportSection(b.dataset.ex, b.dataset.fmt)));
  qsa('[data-all]').forEach(b => b.addEventListener('click', () => exportEverything(b.dataset.all)));
}

/* ── COMMAND PALETTE ── */
let cmdItems = [], cmdSel = 0;
function buildCmds(){
  const c = [];
  Object.keys(VIEW_META).forEach(v => {
    if(v === 'approvals' && !isAdmin()) return;
    c.push({ g:'Go to', t:VIEW_META[v][0], s:VIEW_META[v][1], run:()=>go(v) });
  });
  c.push({ g:'Sessions', t:'Save a session', s:'Snapshot the whole plan', run:()=>{ closeCmd(); newSession(); } });
  c.push({ g:'Sessions', t:'Browse sessions', s:'Restore or download a snapshot', run:()=>openDrawer('sessions') });
  c.push({ g:'Sessions', t:'Import a session file', s:'Load a .json snapshot', run:()=>{ closeCmd(); importSession(); } });
  c.push({ g:'Sync', t:'GitHub sync', s:'Push or pull the plan', run:()=>openDrawer('sync') });
  c.push({ g:'Export', t:'Download a section', s:'CSV, Markdown or JSON', run:()=>openDrawer('export') });
  c.push({ g:'Export', t:'Export full plan as Markdown', s:'Every section, one file', run:()=>{ closeCmd(); exportEverything('md'); } });
  c.push({ g:'Export', t:'Print current view', s:'Slide-proportioned PDF', run:()=>{ closeCmd(); setTimeout(()=>window.print(),120); } });
  if(isAdmin()) c.push({ g:'KOL', t:'Add a creator', s:'New roster entry', run:()=>{ closeCmd(); go('kol'); setTimeout(()=>kolForm(-1),150); } });
  else c.push({ g:'KOL', t:'Add a creator', s:'New roster entry', run:()=>{ closeCmd(); go('kol'); setTimeout(()=>kolForm(-1),150); } });
  c.push({ g:'KOL', t:'Build a research prompt', s:'Verified-data-only lookup', run:()=>{ closeCmd(); go('kol'); setTimeout(()=>el('resHandle').focus(),200); } });
  if(!isAdmin()) c.push({ g:'Approvals', t:'Request a change', s:'Send to an administrator',
    run:()=>{ closeCmd(); openRequest('General','', '', '', ''); } });
  return c;
}
function openCmd(){
  cmdItems = buildCmds(); cmdSel = 0;
  el('cmd').hidden = false;
  el('cmdInput').value = ''; el('cmdInput').focus();
  drawCmd('');
}
function closeCmd(){ el('cmd').hidden = true; }
function drawCmd(q){
  const ql = q.toLowerCase().trim();
  const list = ql ? cmdItems.filter(i => (i.t+' '+i.s+' '+i.g).toLowerCase().includes(ql)) : cmdItems;
  cmdSel = Math.min(cmdSel, Math.max(0, list.length-1));
  el('cmdList').innerHTML = list.length ? list.map((i,ix) =>
    `<button class="cmd-i ${ix===cmdSel?'on':''}" data-ix="${ix}">
      <span class="cmd-g">${esc(i.g)}</span>
      <span class="cmd-t">${esc(i.t)}</span>
      <span class="cmd-s">${esc(i.s)}</span></button>`).join('')
    : `<div class="cmd-none">Nothing matches “${esc(q)}”</div>`;
  el('cmdList')._list = list;
  qsa('.cmd-i').forEach(b => b.addEventListener('click', () => { list[+b.dataset.ix].run(); if(!el('cmd').hidden) closeCmd(); }));
}
el('cmdInput').addEventListener('input', e => { cmdSel = 0; drawCmd(e.target.value); });
el('cmdInput').addEventListener('keydown', e => {
  const list = el('cmdList')._list || [];
  if(e.key === 'ArrowDown'){ e.preventDefault(); cmdSel = Math.min(cmdSel+1, list.length-1); drawCmd(el('cmdInput').value); }
  if(e.key === 'ArrowUp'){ e.preventDefault(); cmdSel = Math.max(cmdSel-1, 0); drawCmd(el('cmdInput').value); }
  if(e.key === 'Enter'){ e.preventDefault(); if(list[cmdSel]){ list[cmdSel].run(); if(!el('cmd').hidden) closeCmd(); } }
  if(e.key === 'Escape') closeCmd();
});
el('cmd').addEventListener('click', e => { if(e.target === el('cmd')) closeCmd(); });

/* ── SORTABLE TABLES ── */
function makeSortable(table){
  if(!table || table._sortable) return;
  table._sortable = true;
  const ths = qsa('th', table);
  ths.forEach((th, i) => {
    if(th.dataset.nosort !== undefined) return;
    th.classList.add('sortable');
    th.addEventListener('click', () => {
      const tb = table.tBodies[0]; if(!tb) return;
      const rows = [...tb.rows].filter(r => !r.classList.contains('tot'));
      const totals = [...tb.rows].filter(r => r.classList.contains('tot'));
      const dir = th._dir = (th._dir === 'asc' ? 'desc' : 'asc');
      ths.forEach(o => { if(o!==th) o.removeAttribute('data-dir'); });
      th.dataset.dir = dir;
      const val = r => {
        const c = r.cells[i]; if(!c) return '';
        const t = c.textContent.trim();
        const n = parseFloat(t.replace(/[^0-9.\-]/g,''));
        return (!isNaN(n) && /[0-9]/.test(t)) ? n : t.toLowerCase();
      };
      rows.sort((a,b) => {
        const x = val(a), y = val(b);
        if(typeof x === 'number' && typeof y === 'number') return dir==='asc'?x-y:y-x;
        return dir==='asc' ? String(x).localeCompare(String(y)) : String(y).localeCompare(String(x));
      });
      rows.forEach(r => tb.appendChild(r));
      totals.forEach(r => tb.appendChild(r));
    });
  });
}
function refreshSortable(){
  ['skuTable','bundleTable','budgetTable','allocTable','kolTable','calTable',
   'eventTable','scoreTable','kpiTable','phaseTable'].forEach(id => makeSortable(el(id)));
}

/* ── SECTION EXPORT BUTTONS on each panel ── */
const PANEL_EXPORT = {
  skuTable:'pricing', bundleTable:'bundles', budgetTable:'media', allocTable:'alloc',
  kolTable:'kol', calTable:'calendar', eventTable:'events', scoreTable:'report'
};
function injectPanelExports(){
  Object.keys(PANEL_EXPORT).forEach(id => {
    const t = el(id); if(!t) return;
    const panel = t.closest('.panel'); if(!panel) return;
    const h = qs('.p-h', panel); if(!h || qs('.p-dl', h)) return;
    const sec = PANEL_EXPORT[id];
    const w = document.createElement('div');
    w.className = 'p-dl';
    w.innerHTML = `<button class="p-dl-b" title="Download this table">↓</button>
      <div class="p-dl-m"><button data-pd="csv">CSV</button><button data-pd="md">Markdown</button><button data-pd="json">JSON</button></div>`;
    h.appendChild(w);
    qs('.p-dl-b', w).addEventListener('click', e => { e.stopPropagation(); w.classList.toggle('on'); });
    qsa('[data-pd]', w).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); w.classList.remove('on'); exportSection(sec, b.dataset.pd);
    }));
  });
}
document.addEventListener('click', () => qsa('.p-dl.on').forEach(w => w.classList.remove('on')));

/* ── SHORTCUTS ── */
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); openCmd(); return; }
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); newSession(); return; }
  if(typing) return;
  if(e.key === '?'){ e.preventDefault(); showShortcuts(); }
  if(e.key === 'Escape'){ if(!el('cmd').hidden) closeCmd(); else if(!el('drawer').hidden) closeDrawer(); }
  const keys = { '1':'overview','2':'strategy','3':'pricing','4':'media','5':'kol','6':'events','7':'calendar','8':'report' };
  if(keys[e.key]) go(keys[e.key]);
});
function showShortcuts(){
  modal('Keyboard shortcuts', `<table class="kbd-t">
    ${[['⌘K / Ctrl K','Open the command palette'],['⌘S / Ctrl S','Save a session'],
       ['1 – 8','Jump to a section'],['?','This list'],['Esc','Close whatever is open'],
       ['Click a column heading','Sort the table by it']]
      .map(([k,v])=>`<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`).join('')}
  </table>`, [['Close','x']], ()=>true);
}

/* ── WIRE UP ── */
function initConsoleUI(){
  loadSessions();
  el('sessBtn').addEventListener('click', () => openDrawer('sessions'));
  el('cmdBtn').addEventListener('click', openCmd);
  el('drawerX').addEventListener('click', closeDrawer);
  el('drawer').addEventListener('click', e => { if(e.target === el('drawer')) closeDrawer(); });
  qsa('.dw-tab').forEach(b => b.addEventListener('click', () => drawerTab(b.dataset.tab)));
  el('newSessBtn').addEventListener('click', newSession);
  el('impSessBtn').addEventListener('click', importSession);
  refreshSortable();
  injectPanelExports();
}

/* auto-push hook */
const _saveSessions = saveSessions;
saveSessions = function(){
  _saveSessions();
  if(SYNC.auto && SYNC.token){
    ghPush().then(()=>toast('Pushed to GitHub')).catch(()=>{});
  }
};
