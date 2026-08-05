/* ════════════════════════════════════════════════
   KOL hub
   Two rosters, evaluated differently:
   UGC creators earn reviews. Livestream creators
   earn GMV — and are scored before any fee is set.
   Approved and later records cannot be deleted by
   the team; they are part of the record.
   ════════════════════════════════════════════════ */

let kolTab = 'ugc';

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
  return isAdmin() || !isLocked(k);
}

/* ── render ── */
function renderKol(){
  renderKolTabs();
  renderKolPipe();
  renderKolTable();
  renderCompPulse();
  renderLongTailPlan();
  renderCrm();
  renderKolSchedule();
  if(typeof refreshSortable === 'function'){ refreshSortable(); injectPanelExports(); }
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
    return `<button class="pipe-s ${s.locked?'lk':''}" data-stage="${s.k}" title="${esc(s.desc)}">
      <div class="ps-n">${esc(s.name)}${s.locked?' <span class="lk-i">🔒</span>':''}</div>
      <div class="ps-c">${n}</div></button>`;
  }).join('');
  qsa('.pipe-s').forEach(b => b.addEventListener('click', () => {
    b.classList.toggle('on'); renderKolTable();
  }));
}

function renderKolTable(){
  const active = qsa('.pipe-s.on').map(b => b.dataset.stage);
  let list = S.kols.filter(k => (k.type||'ugc') === kolTab);
  if(active.length) list = list.filter(k => active.includes(k.stage));

  el('kolEmpty').hidden = list.length > 0;
  if(!list.length){
    el('kolTable').innerHTML = '';
    el('kolEmpty').innerHTML = kolTab === 'ugc'
      ? `No UGC creators yet. Research a handle above, then add what you could verify.`
      : `No livestream creators yet. Add one, then run the fit checklist before agreeing any fee.`;
    return;
  }

  const v = x => x ? esc(x) : '<span class="nv">not verified</span>';

  const head = kolTab === 'ugc'
    ? `<th>Creator</th><th>Tier</th><th class="n">Followers</th><th class="n">Engagement</th>
       <th class="n">Posts</th><th>Audience</th><th>Contact</th><th class="n">Rate</th><th>Stage</th><th></th>`
    : `<th>Creator</th><th class="n">Followers</th><th class="n">Avg views</th><th class="n">GPM</th>
       <th>Band</th><th class="n">Fit</th><th>Recommended terms</th><th>Contact</th><th>Stage</th><th></th>`;

  el('kolTable').innerHTML = `<thead><tr>${head}</tr></thead><tbody>` + list.map(k => {
    const i = S.kols.indexOf(k);
    const locked = isLocked(k);
    const del = canDelete(k);
    const stageSel = `<select class="k-stage" data-i="${i}">${KOL_PIPE.map(s =>
      `<option value="${s.k}"${k.stage===s.k?' selected':''}>${s.name}</option>`).join('')}</select>`;
    const acts = `<div class="k-acts">
      <button class="btn-line sm" data-edit="${i}">${locked && !isAdmin() ? 'View' : 'Edit'}</button>
      ${kolTab==='live'?`<button class="btn-line sm" data-fit="${i}">Fit</button>`:''}
      <button class="btn-line sm" data-sched="${i}">Schedule</button>
      ${del?`<button class="btn-line sm danger" data-del="${i}">Delete</button>`
           :`<span class="lock-t" title="Approved and later records cannot be removed by the team">🔒</span>`}
    </div>`;

    if(kolTab === 'ugc'){
      return `<tr><td><b>${esc(k.handle)}</b><span class="sub">${esc(k.platform||'')}${k.name?' · '+esc(k.name):''}</span></td>
        <td><span class="pill p-n">${esc(k.tier||'—')}</span></td>
        <td class="n">${v(k.followers)}</td>
        <td class="n">${k.er?esc(k.er)+'%':'<span class="nv">—</span>'}</td>
        <td class="n">${v(k.posts)}</td>
        <td style="font-size:12px">${v(k.audience)}</td>
        <td style="font-size:12px">${v(k.contact)}</td>
        <td class="n">${k.rate?esc(S.settings.cur+k.rate):'<span class="nv">—</span>'}</td>
        <td>${stageSel}</td><td>${acts}</td></tr>`;
    }

    const g = computeGpm(k);
    const band = gpmBand(g);
    const sc = scenarioFor(k);
    const score = fitScore(k);
    return `<tr><td><b>${esc(k.handle)}</b><span class="sub">${esc(k.platform||'')}${k.name?' · '+esc(k.name):''}</span></td>
      <td class="n">${v(k.followers)}</td>
      <td class="n">${v(k.avgViews)}</td>
      <td class="n">${g?'$'+Math.round(g).toLocaleString():'<span class="nv">—</span>'}</td>
      <td><span class="pill ${band.tone}">${band.label}</span></td>
      <td class="n"><span class="fit-s ${score>=10?'f3':score>=8?'f2':score>=5?'f1':'f0'}">${score}/10</span></td>
      <td><span class="pill ${sc.tone}">${sc.name}</span>
        <span class="sub">${sc.fee?S.settings.cur+sc.fee.toLocaleString()+' + '+sc.comm+'%':'commission only'}${sc.capped?' · capped':''}</span></td>
      <td style="font-size:12px">${v(k.contact)}</td>
      <td>${stageSel}</td><td>${acts}</td></tr>`;
  }).join('') + `</tbody>`;

  qsa('.k-stage').forEach(s => s.addEventListener('change', () => {
    const k = S.kols[+s.dataset.i];
    const wasLocked = isLocked(k);
    const next = KOL_PIPE.find(p => p.k === s.value);
    if(!isAdmin() && wasLocked && !next.locked){
      toast('Only an administrator can move a record back out of an approved stage');
      s.value = k.stage; return;
    }
    k.stage = s.value; save(); renderKol(); renderOverview();
  }));
  qsa('[data-edit]').forEach(b => b.addEventListener('click', () => kolForm(+b.dataset.edit)));
  qsa('[data-fit]').forEach(b => b.addEventListener('click', () => fitForm(+b.dataset.fit)));
  qsa('[data-sched]').forEach(b => b.addEventListener('click', () => schedForm(+b.dataset.sched)));
  qsa('[data-del]').forEach(b => b.addEventListener('click', () => delKol(+b.dataset.del)));
}

/* ── add / edit ── */
function kolForm(idx, pre){
  const k = idx >= 0 ? S.kols[idx] : (pre || { type: kolTab });
  const type = k.type || kolTab;
  const T = KOL_TYPES[type];
  const locked = idx >= 0 && isLocked(k) && !isAdmin();

  const f = (id,l,val,ph,hint) => `<div class="mf"><label>${l}</label>
    <input id="${id}" value="${esc(val||'')}" placeholder="${esc(ph||'')}"${locked?' readonly':''}>
    ${hint?`<p class="fh">${esc(hint)}</p>`:''}</div>`;

  const common = `
    <div class="mf2">${f('kHandle','Handle',k.handle,'@handle')}
      <div class="mf"><label>Platform</label><select id="kPlat"${locked?' disabled':''}>
        ${['TikTok','Instagram','YouTube','Shopee Live','Xiaohongshu'].map(p=>
          `<option${k.platform===p?' selected':''}>${p}</option>`).join('')}</select></div></div>
    <div class="mf2">${f('kName','Display name',k.name)}
      <div class="mf"><label>Tier</label><select id="kTier"${locked?' disabled':''}>
        ${['Nano','Micro','Macro'].map(t=>`<option${k.tier===t?' selected':''}>${t}</option>`).join('')}</select></div></div>
    <div class="mf2">${f('kFoll','Followers',k.followers,'blank if unverified')}
      ${f('kAud','Audience',k.audience,'e.g. 82% female · 25–34 · SG')}</div>
    ${f('kContact','Contact',k.contact,'email, agency, or DM open')}
    ${f('kSource','Source URL',k.source,'where the figures were verified')}`;

  const ugcOnly = `
    <div class="mf2">${f('kEr','Engagement rate %',k.er,'blank if unverified')}
      ${f('kPosts','Total posts',k.posts)}</div>
    ${f('kRate','Rate per post',k.rate,'in ' + S.settings.cur)}`;

  const liveOnly = `
    <div class="mf2">${f('kViews','Average views per stream',k.avgViews,'blank if unverified')}
      ${f('kGmv','Average GMV per stream',k.avgGmv,'blank if unverified')}</div>
    <div class="mf2">${f('kGpm','GPM if known',k.gpm,'leave blank to calculate','Calculated as GMV ÷ views × 1,000 when both are entered')}
      ${f('kRet','Average view time',k.retention,'e.g. 6m 20s')}</div>
    ${f('kFee','Agreed fixed fee',k.fee,'in ' + S.settings.cur)}`;

  const body = `
    <div class="mf"><label>Creator type</label>
      <div class="type-pick">${Object.values(KOL_TYPES).map(t=>
        `<label class="tp ${type===t.k?'on':''}">
          <input type="radio" name="ktype" value="${t.k}"${type===t.k?' checked':''}${idx>=0||locked?' disabled':''}>
          <b>${esc(t.name)}</b><span>${esc(t.goal)}</span></label>`).join('')}</div></div>
    ${common}
    ${type === 'ugc' ? ugcOnly : liveOnly}
    <div class="mf"><label>Notes</label>
      <textarea id="kNotes" rows="3"${locked?' readonly':''}>${esc(k.notes||'')}</textarea></div>
    <div class="mf verify-note">Leave a field blank when you could not verify it.
      An empty field is honest; a guess presented as data is not.</div>
    ${locked?`<div class="mf lock-note">This record is at the <b>${esc((KOL_PIPE.find(s=>s.k===k.stage)||{}).name)}</b> stage.
      It is read-only for team members — ask an administrator to change agreed terms.</div>`:''}`;

  const btns = locked
    ? [['Close','x']]
    : (idx>=0
        ? (canDelete(k) ? [['Delete','del'],['Cancel','x'],['Save','ok']] : [['Cancel','x'],['Save','ok']])
        : [['Cancel','x'],['Add creator','ok']]);

  modal(idx>=0 ? (locked?'Creator record':'Edit creator') : 'Add creator', body, btns, a => {
    if(a === 'x') return true;
    if(a === 'del'){ delKol(idx); return true; }
    const h = el('kHandle').value.trim();
    if(!h){ toast('A handle is required'); return false; }
    const picked = qs('input[name=ktype]:checked');
    const rec = Object.assign({}, idx>=0 ? S.kols[idx] : {}, {
      type: picked ? picked.value : type,
      handle: h.startsWith('@') ? h : '@'+h,
      platform: el('kPlat').value, name: el('kName').value.trim(),
      tier: el('kTier').value, followers: el('kFoll').value.trim(),
      audience: el('kAud').value.trim(), contact: el('kContact').value.trim(),
      source: el('kSource').value.trim(), notes: el('kNotes').value.trim(),
      stage: idx>=0 ? S.kols[idx].stage : 'sourced'
    });
    if((picked?picked.value:type) === 'ugc'){
      rec.er = el('kEr').value.trim(); rec.posts = el('kPosts').value.trim();
      rec.rate = el('kRate').value.trim();
    } else {
      rec.avgViews = el('kViews').value.trim(); rec.avgGmv = el('kGmv').value.trim();
      rec.gpm = el('kGpm').value.trim(); rec.retention = el('kRet').value.trim();
      rec.fee = el('kFee').value.trim(); rec.fit = rec.fit || {};
    }
    if(idx>=0) S.kols[idx] = rec; else S.kols.push(rec);
    save(); renderKol(); renderOverview();
    toast(idx>=0 ? 'Creator updated' : 'Creator added');
    return true;
  });

  qsa('.tp input').forEach(r => r.addEventListener('change', () => {
    closeModal(); kolForm(idx, Object.assign({}, k, { type: r.value }));
  }));
}

function delKol(idx){
  const k = S.kols[idx];
  if(!canDelete(k)){
    modal('This record cannot be removed', `<p style="font-size:13.5px;line-height:1.6;color:var(--mute)">
      <b style="color:var(--ink)">${esc(k.handle)}</b> is at the
      <b style="color:var(--ink)">${esc((KOL_PIPE.find(s=>s.k===k.stage)||{}).name)}</b> stage.</p>
      <p style="font-size:13px;color:var(--mute);margin-top:10px">
      Once terms are approved, the record becomes part of the working history — spend, deliverables and
      results are traced back to it. Team members can move it forward through the pipeline and mark it
      complete or declined, but not delete it. Ask an administrator if it was created in error.</p>`,
      [['Close','x']], ()=>true);
    return;
  }
  modal('Delete this creator?', `<p style="font-size:13.5px;color:var(--mute);line-height:1.6">
    <b style="color:var(--ink)">${esc(k.handle)}</b> will be removed along with anything scheduled
    against them. This cannot be undone.</p>`,
    [['Keep','x'],['Delete','ok']], a => {
      if(a !== 'ok') return true;
      S.schedule = (S.schedule||[]).filter(e => e.kol !== k.handle);
      S.kols.splice(idx,1); save(); renderKol(); renderOverview();
      toast('Creator removed');
      return true;
    });
}

/* ── fit checklist ── */
function fitForm(idx){
  const k = S.kols[idx];
  k.fit = k.fit || {};
  const locked = isLocked(k) && !isAdmin();
  const cats = [...new Set(FIT_FACTORS.map(f=>f.cat))];

  modal(`Fit check — ${k.handle}`, `
    <div class="fit-intro">Tick only what you have actually seen. The score sets which fee is rational —
      over-ticking here is how a brand ends up paying a mega fee for a test-tier creator.</div>
    ${cats.map(c => `<div class="fit-cat"><span class="fc-l">${esc(c)}</span>
      ${FIT_FACTORS.filter(f=>f.cat===c).map(f => `
        <label class="fit-i ${f.critical?'crit':''}">
          <input type="checkbox" data-fit="${f.k}"${k.fit[f.k]?' checked':''}${locked?' disabled':''}>
          <span><b>${esc(f.name)}${f.critical?' <em>critical</em>':''}</b>${esc(f.test)}</span></label>`).join('')}
    </div>`).join('')}
    <div id="fitOut"></div>`,
    locked ? [['Close','x']] : [['Cancel','x'],['Save assessment','ok']], a => {
      if(a !== 'ok') return true;
      qsa('[data-fit]').forEach(c => { k.fit[c.dataset.fit] = c.checked; });
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
    <div class="mf"><label>Notes</label><textarea id="scNote" rows="2" placeholder="Offer, bundle price, talking points"></textarea></div>`,
    [['Cancel','x'],['Add to schedule','ok']], a => {
      if(a !== 'ok') return true;
      S.schedule = S.schedule || [];
      S.schedule.push({
        id:'E'+Date.now().toString(36), kol:k.handle, type,
        what: el('scType').value, date: el('scDate').value, time: el('scTime').value,
        owner: el('scOwner').value.trim(), note: el('scNote').value.trim(),
        done:false, at:new Date().toISOString()
      });
      if(k.stage === 'approved') k.stage = 'scheduled';
      save(); renderKol();
      toast('Added to the schedule');
      return true;
    });
}

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
  box.innerHTML = `<div class="tb-wrap"><table class="tb" id="schedTable">
    <thead><tr><th>Date</th><th>Time</th><th>Creator</th><th>Type</th><th>Deliverable</th>
      <th>Owner</th><th>Notes</th><th>Status</th><th></th></tr></thead><tbody>` +
    all.map(e => {
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
        <td>${e.done?`<span class="pill p-g">Done</span>`
              :past?`<span class="pill p-r">Overdue</span>`
              :`<span class="pill p-a">Booked</span>`}</td>
        <td><div class="k-acts">
          <button class="btn-line sm" data-scdone="${e.id}">${e.done?'Reopen':'Mark done'}</button>
          <button class="btn-line sm" data-scics="${e.id}">Calendar</button>
          ${(isAdmin()||!e.done)?`<button class="btn-line sm danger" data-scdel="${e.id}">Remove</button>`:''}
        </div></td></tr>`;
    }).join('') + `</tbody></table></div>`;

  qsa('[data-scdone]').forEach(b => b.addEventListener('click', () => {
    const e = S.schedule.find(x=>x.id===b.dataset.scdone);
    e.done = !e.done; save(); renderKolSchedule();
  }));
  qsa('[data-scdel]').forEach(b => b.addEventListener('click', () => {
    S.schedule = S.schedule.filter(x=>x.id!==b.dataset.scdel);
    save(); renderKolSchedule(); toast('Removed from the schedule');
  }));
  qsa('[data-scics]').forEach(b => b.addEventListener('click', () => {
    downloadIcs(S.schedule.find(x=>x.id===b.dataset.scics));
  }));

  const dl = el('schedAllIcs');
  if(dl) dl.onclick = () => downloadIcs(null);
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

function renderCompPulse(){
  const box = el('compPulse'); if(!box) return;
  const priceTag = (row, key) => {
    const v = row[key]; if(!v) return '—';
    return (row.currency === 'USD' ? '$' : 'S$') + v;
  };
  const rows = COMPETITOR_INTEL.map(r => `
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
      <span>Observed ${esc((COMPETITOR_INTEL[0]||{}).observedAt || '')} · refresh weekly before decisions</span>
      <button class="btn-line sm" id="expCompCsv">Download tracker CSV</button>
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
      ...COMPETITOR_INTEL.map(r => [r.competitor,r.product,r.productType,r.channel,r.currency,r.listPrice,r.promoPrice,r.observedAt,r.keyMessage,r.source])
    ];
    dl('dnuvo-competitor-tracker-' + stamp() + '.csv', toCSV(csvRows), 'text/csv;charset=utf-8');
    toast('Competitor tracker downloaded');
  });
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
