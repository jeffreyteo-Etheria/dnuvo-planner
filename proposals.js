/* ════════════════════════════════════════════════
   Proposals
   A team edit never writes to the plan. It is held
   as a proposal against a specific record + field.
   The live value stays untouched until an admin
   either applies it or keeps what is there.
   ════════════════════════════════════════════════ */

/* key identifies the exact cell: type:id:field */
function propKey(type, id, field){ return `${type}:${id}:${field}`; }

function pendingFor(type, id, field){
  return (S.proposals || []).find(p =>
    p.key === propKey(type,id,field) && p.status === 'pending');
}
function pendingCount(){
  return (S.proposals || []).filter(p => p.status === 'pending').length;
}
function pendingOn(type, id){
  return (S.proposals || []).filter(p =>
    p.status === 'pending' && p.key.startsWith(`${type}:${id}:`));
}

/* Record a proposal. Never mutates the underlying record. */
function propose(type, id, field, current, next, label){
  if(String(current) === String(next)) return false;
  S.proposals = S.proposals || [];
  // one live proposal per cell — a newer one supersedes
  const prev = pendingFor(type, id, field);
  if(prev){ prev.status = 'superseded'; prev.closedAt = new Date().toISOString(); }
  S.proposals.push({
    id: 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    key: propKey(type,id,field),
    type, recId:id, field,
    label: label || '',
    from: current, to: next,
    by: role, at: new Date().toISOString(),
    status: 'pending', note: ''
  });
  save();
  return true;
}

/* Apply — write the proposed value into the live record. */
function applyProposal(p){
  if(p.type === 'sku'){
    const s = S.skus.find(x => x.id === p.recId);
    if(s) s[p.field] = /^(sale|cogs|msrp|units)$/.test(p.field) ? num(p.to) : p.to;
  } else if(p.type === 'bundle'){
    S.bundleOverrides = S.bundleOverrides || {};
    S.bundleOverrides[p.recId] = S.bundleOverrides[p.recId] || {};
    S.bundleOverrides[p.recId][p.field] = p.field === 'price' ? num(p.to) : p.to;
  } else if(p.type === 'month'){
    const m = S.months.find(x => x.k === p.recId);
    if(m) m[p.field] = num(p.to);
  } else if(p.type === 'kol'){
    const k = (S.kols||[]).find(x => x.id === p.recId);
    if(k) k[p.field] = p.to;
  }
  p.status = 'approved';
  p.closedAt = new Date().toISOString();
  p.closedBy = role;
}
function keepCurrent(p, why){
  p.status = 'kept';
  p.note = why || '';
  p.closedAt = new Date().toISOString();
  p.closedBy = role;
}

/* Bundle reader that respects approved overrides */
function bundleView(b){
  const o = (S.bundleOverrides || {})[b.id] || {};
  return Object.assign({}, b, o);
}

/* ── Cell renderer ─────────────────────────────────
   Admin sees the live value plus, when something is
   proposed, the proposal flashing beside it.
   Team sees their own proposal marked as awaiting.  */
function cell(type, id, field, value, label, opts){
  opts = opts || {};
  const p = pendingFor(type, id, field);
  const pre = opts.prefix || '';
  const editable = isAdmin()
    ? (opts.adminEdit !== false)
    : (PROPOSABLE[type] || []).includes(field);

  let html = '';

  if(editable){
    html += `<span class="ed${p?' has-prop':''}" contenteditable="true"
      data-cell="${type}|${id}|${field}" data-label="${esc(label||'')}"
      data-orig="${esc(value)}">${esc(value)}</span>`;
  } else {
    html += `<span>${pre}${esc(value)}</span>`;
  }

  if(p){
    if(isAdmin()){
      html += ` <span class="prop-flag" data-prop="${p.id}" title="Proposed by the team — click to decide">
        <span class="pf-dot"></span>${pre}${esc(p.to)}</span>`;
    } else {
      html += ` <span class="prop-mine" title="Waiting on an administrator">→ ${pre}${esc(p.to)}</span>`;
    }
  }
  return html;
}

/* Wire every rendered cell. Admin writes straight through;
   team writes a proposal and the cell snaps back.          */
function wireCells(){
  qsa('[data-cell]').forEach(c => {
    if(c._wired) return; c._wired = true;
    c.addEventListener('focus', () => { c._before = c.textContent.trim(); });
    c.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ e.preventDefault(); c.blur(); }
      if(e.key === 'Escape'){ c.textContent = c.dataset.orig; c.blur(); }
    });
    c.addEventListener('blur', () => {
      const [type,id,field] = c.dataset.cell.split('|');
      const next = c.textContent.trim();
      const orig = c.dataset.orig;
      if(next === orig) return;

      if(isAdmin()){
        if(type === 'sku'){
          const s = S.skus.find(x=>x.id===id);
          if(s) s[field] = /^(sale|cogs|msrp|units)$/.test(field) ? num(next) : next;
        } else if(type === 'bundle'){
          S.bundleOverrides = S.bundleOverrides || {};
          S.bundleOverrides[id] = S.bundleOverrides[id] || {};
          S.bundleOverrides[id][field] = field==='price' ? num(next) : next;
        } else if(type === 'month'){
          const m = S.months.find(x=>x.k===id);
          if(m) m[field] = num(next);
        }
        save(); renderAll();
      } else {
        const ok = propose(type, id, field, orig, next, c.dataset.label);
        c.textContent = orig;            // live value is untouched
        renderAll();
        if(ok) toast('Sent for approval — the current value stays until it is reviewed');
      }
    });
  });

  // admin clicks a flashing proposal to decide on it
  qsa('[data-prop]').forEach(f => {
    if(f._wired) return; f._wired = true;
    f.addEventListener('click', e => { e.stopPropagation(); decideProposal(f.dataset.prop); });
  });
}

/* ── Decision modal ── */
function decideProposal(pid){
  const p = (S.proposals||[]).find(x => x.id === pid);
  if(!p) return;
  const when = new Date(p.at);
  modal('Review this change', `
    <div class="dec">
      <div class="dec-meta">
        <span class="pill p-n">${esc(p.type)}</span>
        <b>${esc(p.label || p.field)}</b>
        <span class="dec-when">proposed ${when.toLocaleDateString()} ${when.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      </div>
      <div class="dec-cmp">
        <div class="dec-side keep">
          <span class="ds-l">Current — stays if you keep it</span>
          <b>${esc(p.from) || '—'}</b>
        </div>
        <span class="dec-arrow">→</span>
        <div class="dec-side new">
          <span class="ds-l">Proposed by the team</span>
          <b>${esc(p.to) || '—'}</b>
        </div>
      </div>
      ${p.field === 'sale' || p.field === 'price' ? floorWarning(p) : ''}
      <div class="mf" style="margin-top:14px">
        <label>Note — optional, shown to the team</label>
        <input id="decNote" placeholder="Why you decided this way">
      </div>
    </div>`,
    [['Keep current','keep'],['Approve change','ok']], a => {
      const why = (el('decNote')||{}).value || '';
      if(a === 'ok'){ applyProposal(p); toast('Approved and applied'); }
      else { keepCurrent(p, why); toast('Kept the current value'); }
      save(); renderAll();
      return true;
    });
}

/* If a price proposal breaks the floor, say so in the decision. */
function floorWarning(p){
  let sku = null;
  if(p.type === 'sku') sku = S.skus.find(x => x.id === p.recId);
  if(!sku) return '';
  const f = floorOf(sku);
  const v = num(p.to);
  if(v >= f) return `<div class="dec-note ok">Clears the floor of ${cur(f)} with ${cur(v-f)} to spare.</div>`;
  return `<div class="dec-note bad">This is ${cur(f-v)} <b>below</b> the floor of ${cur(f)}.
    Approving it means selling at a loss on this product.</div>`;
}

/* ── Pending changes panel (admin) ── */
function renderProposals(){
  const box = el('propList');
  if(!box) return;
  const all = (S.proposals || []).slice().reverse();
  const pending = all.filter(p => p.status === 'pending');

  const badge = el('propBadge');
  if(badge){ badge.hidden = !pending.length; badge.textContent = pending.length; }

  if(!all.length){
    box.innerHTML = `<p class="empty">Nothing proposed yet. When a team member edits a figure,
      it appears here and beside the value itself — the live plan does not change until you decide.</p>`;
    return;
  }

  box.innerHTML = all.map(p => {
    const when = new Date(p.at);
    const st = { pending:['p-a','Waiting'], approved:['p-g','Approved'],
                 kept:['p-n','Kept current'], superseded:['p-n','Replaced'] }[p.status];
    return `<div class="prop ${p.status==='pending'?'live':''}">
      <div class="prop-h">
        <span class="pill ${st[0]}">${st[1]}</span>
        <b>${esc(p.label || p.field)}</b>
        <span class="prop-t">${esc(p.type)}</span>
        <span class="prop-w">${when.toLocaleDateString()}</span>
      </div>
      <div class="prop-d">
        <span class="from">${esc(p.from)||'—'}</span><span class="ar">→</span>
        <span class="to">${esc(p.to)||'—'}</span>
      </div>
      ${p.note?`<p class="prop-n">${esc(p.note)}</p>`:''}
      ${p.status==='pending'?`<div class="prop-a">
        <button class="btn-ok" data-pok="${p.id}">Approve</button>
        <button class="btn-no" data-pkeep="${p.id}">Keep current</button>
        <button class="btn-line sm" data-pgo="${p.id}">Show me where</button>
      </div>`:''}
    </div>`;
  }).join('');

  qsa('[data-pok]').forEach(b => b.addEventListener('click', () => {
    const p = S.proposals.find(x=>x.id===b.dataset.pok);
    applyProposal(p); save(); renderAll(); toast('Approved and applied');
  }));
  qsa('[data-pkeep]').forEach(b => b.addEventListener('click', () => {
    const p = S.proposals.find(x=>x.id===b.dataset.pkeep);
    keepCurrent(p); save(); renderAll(); toast('Kept the current value');
  }));
  qsa('[data-pgo]').forEach(b => b.addEventListener('click', () => {
    const p = S.proposals.find(x=>x.id===b.dataset.pgo);
    go(p.type === 'month' ? 'media' : p.type === 'kol' ? 'kol' : 'pricing');
    setTimeout(() => {
      const t = qs(`[data-cell="${p.type}|${p.recId}|${p.field}"]`);
      if(t){
        t.scrollIntoView({behavior:'smooth', block:'center'});
        const row = t.closest('tr');
        if(row){ row.classList.add('row-flash'); setTimeout(()=>row.classList.remove('row-flash'), 2600); }
      }
    }, 220);
  }));
}

/* ── SHOP LINK SYNC ─────────────────────────────────
   Builds the product URL from the store domain and a
   handle. Nothing is guessed — a handle you have not
   entered stays blank and the row reads "not linked".*/
function shopUrlFor(rec){
  if(rec.url) return rec.url;
  if(!rec.handle) return '';
  const d = (S.settings.shopDomain||'').replace(/\/$/,'');
  const p = S.settings.shopPath || '/products/';
  return d + p + rec.handle.replace(/^\//,'');
}

function renderShopSync(){
  const box = el('shopSync');
  if(!box) return;

  const bundles = BUNDLES.map(bundleView);
  const rows = [
    ...S.skus.map(s => ({ ...s, kind:'sku' })),
    ...bundles.map(b => ({ ...b, kind:'bundle' }))
  ];
  const linked = rows.filter(r => shopUrlFor(r)).length;

  box.innerHTML = `
    <div class="shop-head">
      <div class="shop-dom">
        <span class="sd-l">Store</span>
        ${isAdmin()
          ? `<input id="shopDom" value="${esc(S.settings.shopDomain)}">
             <input id="shopPath" value="${esc(S.settings.shopPath)}" style="max-width:120px">`
          : `<b>${esc(S.settings.shopDomain)}</b><span class="sd-p">${esc(S.settings.shopPath)}</span>`}
      </div>
      <span class="shop-count"><b>${linked}</b> of ${rows.length} linked</span>
      ${linked ? `<button class="btn-line sm" id="openAllShop">Open all in tabs</button>` : ''}
    </div>

    <div class="tb-wrap"><table class="tb" id="shopTable">
      <thead><tr><th>Item</th><th>Type</th><th>Handle</th><th>Resolved URL</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map(r => {
        const u = shopUrlFor(r);
        const type = r.kind === 'sku' ? 'sku' : 'bundle';
        return `<tr>
          <td><b>${esc(r.name)}</b></td>
          <td><span class="pill p-n">${r.kind === 'sku' ? 'Product' : 'Bundle'}</span></td>
          <td class="n">${cell(type, r.id, 'handle', r.handle || '', r.name + ' — shop handle')}</td>
          <td class="shop-u">${u
            ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//,''))}</a>`
            : `<span class="unlinked">not linked</span>`}</td>
          <td>${r.urlOk === true ? `<span class="pill p-g">Checked</span>`
              : r.urlOk === false ? `<span class="pill p-r">Not found</span>`
              : u ? `<span class="pill p-a">Unverified</span>` : `<span class="pill p-n">—</span>`}</td>
          <td>${u ? `<button class="btn-line sm" data-chk="${type}|${r.id}">Check</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>

    <div class="shop-note">
      Enter the handle as it appears at the end of the product's address — for
      <b>${esc((S.settings.shopDomain||'').replace(/^https?:\/\//,''))}${esc(S.settings.shopPath)}vitamin-c-ampoule</b>
      the handle is <b>vitamin-c-ampoule</b>. <b>Check</b> opens the page so you can confirm it resolves;
      mark the result yourself. Nothing here is guessed — an unentered handle stays blank rather than
      inventing an address that may not exist.
    </div>`;

  if(isAdmin()){
    const dom = el('shopDom'), pth = el('shopPath');
    if(dom) dom.addEventListener('change', () => { S.settings.shopDomain = dom.value.trim(); save(); renderShopSync(); });
    if(pth) pth.addEventListener('change', () => { S.settings.shopPath = pth.value.trim(); save(); renderShopSync(); });
  }

  const oa = el('openAllShop');
  if(oa) oa.addEventListener('click', () => {
    rows.forEach(r => { const u = shopUrlFor(r); if(u) window.open(u, '_blank', 'noopener'); });
  });

  qsa('[data-chk]').forEach(b => b.addEventListener('click', () => {
    const [type,id] = b.dataset.chk.split('|');
    const rec = type === 'sku' ? S.skus.find(x=>x.id===id) : bundles.find(x=>x.id===id);
    const u = shopUrlFor(rec);
    window.open(u, '_blank', 'noopener');
    modal('Did that page load?', `<p style="font-size:13.5px;line-height:1.6;color:var(--mute)">
      Opened <b style="color:var(--ink)">${esc(u)}</b> in a new tab.</p>
      <p style="font-size:13px;color:var(--mute);margin-top:9px">
      A browser cannot check another site's pages for you, so confirm it yourself and record what you saw.</p>`,
      [['Cancel','x'],['Not found','no'],['It loaded','ok']], a => {
        if(a === 'x') return true;
        if(type === 'sku'){
          const s = S.skus.find(x=>x.id===id); if(s) s.urlOk = (a === 'ok');
        } else {
          S.bundleOverrides = S.bundleOverrides || {};
          S.bundleOverrides[id] = S.bundleOverrides[id] || {};
          S.bundleOverrides[id].urlOk = (a === 'ok');
        }
        save(); renderShopSync();
        toast(a === 'ok' ? 'Marked as checked' : 'Marked as not found');
        return true;
      });
  }));

  wireCells();
}

/* ── LIVE SHOPFRONT PRICING ─────────────────────────
   What is actually listed on each of the 4 storefronts
   linked from linktr.ee/d.nuvo — a separate, dated log
   next to the internal SKU price book above, not a
   replacement for it. Shopify's link reuses the domain
   already set in Shop links; the other 3 are storefront
   home links (no per-product deep-link pattern exists
   for them here), editable by an admin, blank until set. */
function shopfrontUrlFor(platformKey){
  if(platformKey === 'shopify') return S.settings.shopDomain || '';
  return (S.settings.shopfrontLinks || {})[platformKey] || '';
}

function renderShopfrontLinks(){
  const box = el('shopfrontLinks'); if(!box) return;
  box.innerHTML = `<div class="shop-head">` + SHOPFRONT_PLATFORMS.map(p => {
    const url = shopfrontUrlFor(p.k);
    const editable = isAdmin() && p.k !== 'shopify';
    return `<div class="sf-link">
      <span class="sd-l">${esc(p.name)}</span>
      ${editable
        ? `<input data-sflink="${p.k}" value="${esc(url)}" placeholder="storefront URL">`
        : url
          ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//,''))}</a>`
          : `<span class="unlinked">not linked yet</span>`}
    </div>`;
  }).join('') + `</div>`;

  qsa('[data-sflink]', box).forEach(inp => inp.addEventListener('change', () => {
    S.settings.shopfrontLinks[inp.dataset.sflink] = inp.value.trim();
    save(); renderShopfrontLinks();
  }));
}

function renderShopfrontPriceTable(){
  const box = el('shopfrontPriceTable'); if(!box) return;
  const bundles = BUNDLES.map(bundleView);
  const rows = [...S.skus.map(s => ({...s, kind:'sku'})), ...bundles.map(b => ({...b, kind:'bundle'}))];
  S.shopfrontPrices = S.shopfrontPrices || {};

  box.innerHTML = `<thead><tr><th rowspan="2">Item</th>${SHOPFRONT_PLATFORMS.map(p =>
      `<th colspan="2">${esc(p.name)}</th>`).join('')}</tr>
    <tr>${SHOPFRONT_PLATFORMS.map(() => `<th class="n">Price</th><th>As of</th>`).join('')}</tr></thead><tbody>` +
    rows.map(r => {
      const rec = S.shopfrontPrices[r.id] = S.shopfrontPrices[r.id] || {};
      return `<tr><td><b>${esc(r.name)}</b></td>` + SHOPFRONT_PLATFORMS.map(p => {
        const d = rec[p.k] || {};
        return `<td class="n"><span class="ed" contenteditable="true" data-sfprice="${r.id}|${p.k}">${d.price!=null?esc(d.price):''}</span></td>
          <td style="font-size:11px;color:var(--faint)">${esc(d.checkedAt||'—')}</td>`;
      }).join('') + `</tr>`;
    }).join('') + `</tbody>`;

  qsa('[data-sfprice]', box).forEach(c => c.addEventListener('blur', () => {
    const [id, plat] = c.dataset.sfprice.split('|');
    const raw = c.textContent.trim();
    S.shopfrontPrices[id] = S.shopfrontPrices[id] || {};
    if(!raw){
      delete S.shopfrontPrices[id][plat];
    } else if(num(raw) === 0 && raw !== '0'){
      toast(`"${raw}" doesn't look like a price — not saved`);
      c.textContent = (S.shopfrontPrices[id][plat]||{}).price != null ? String(S.shopfrontPrices[id][plat].price) : '';
      return;
    } else {
      S.shopfrontPrices[id][plat] = { price: num(raw), checkedAt: new Date().toISOString().slice(0,10) };
    }
    save();
    renderShopfrontPriceTable();
    renderShopfrontNote(rows);
  }));

  renderShopfrontNote(rows);
}

/* Flags any logged Shopify price that disagrees with the internal SKU/bundle
   price book — the two are meant to match; a gap usually means one side
   changed without the other being told. */
function renderShopfrontNote(rows){
  const note = el('shopfrontNote'); if(!note) return;
  const mismatches = rows.filter(r => {
    const obs = (S.shopfrontPrices[r.id]||{}).shopify;
    const internal = r.sale != null ? r.sale : r.price;
    return obs && obs.price != null && num(obs.price) !== num(internal);
  });
  if(!mismatches.length){
    note.className = 'hint-bar ok';
    note.textContent = 'No logged Shopify price disagrees with the internal price book above.';
    return;
  }
  note.className = 'hint-bar bad';
  note.innerHTML = `<b>${mismatches.length} item${mismatches.length===1?'':'s'} logged at a different price than the internal book.</b> ` +
    mismatches.map(r => {
      const obs = S.shopfrontPrices[r.id].shopify;
      const internal = r.sale != null ? r.sale : r.price;
      return `${esc(r.name)}: live ${esc(S.settings.cur)}${obs.price} vs book ${esc(S.settings.cur)}${internal}`;
    }).join(' · ');
}

/* ── PROMO PRICING ──────────────────────────────────
   Pick a named promo strategy (BAU/Payday/9.9/11.11/…, the same catalog
   Campaign setup uses) and see the resulting price — Shopify is always
   the lead: MSRP × (1 − discount%) — checked against every other
   platform's own floor, since a fee-heavier channel can fail at a price
   Shopify clears fine. Apply writes the result into Live shopfront
   pricing above; nothing here retags a month or touches channel-split
   suggestions in Media plan. */
let selectedPromo = 'bau';

function renderPromoGrid(){
  const box = el('promoGrid'); if(!box) return;
  box.innerHTML = `<div class="promo-grid">${PROMO_PERIODS.map(p => {
    const pct = (S.settings.promoDiscounts||{})[p.k] != null ? S.settings.promoDiscounts[p.k] : p.discountPct;
    return `<div class="promo-card selectable${selectedPromo===p.k?' on':''}" data-promo="${p.k}">
      <span>${esc(p.k)}</span><b>${esc(p.name)}</b>
      <p>${esc(p.mechanicNote)}</p>
      <p style="margin-top:6px">Suggested discount: ${isAdmin()
        ? `<input type="number" min="0" max="90" class="pct-in" data-promopct="${p.k}" value="${pct}">%`
        : `<b>${pct}%</b>`}</p>
    </div>`;
  }).join('')}</div>`;

  qsa('[data-promo]', box).forEach(card => card.addEventListener('click', () => {
    selectedPromo = card.dataset.promo;
    renderPromoGrid();
    renderPromoPriceTable();
  }));
  qsa('[data-promopct]', box).forEach(inp => {
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('change', () => {
      S.settings.promoDiscounts[inp.dataset.promopct] = num(inp.value);
      save();
      renderPromoPriceTable();
    });
  });
}

function renderPromoPriceTable(){
  const box = el('promoPriceTable'); if(!box) return;
  const pct = (S.settings.promoDiscounts||{})[selectedPromo] || 0;
  const promo = PROMO_PERIODS.find(p => p.k === selectedPromo);

  const head = `<th>Item</th><th class="n">Suggested price</th>` +
    SHOPFRONT_PLATFORMS.map(p => `<th>${esc(p.name)}</th>`).join('');

  box.innerHTML = `<thead><tr>${head}</tr></thead><tbody>` +
    S.skus.map(s => {
      const price = Math.round(s.msrp * (1 - pct/100) * 100) / 100;
      const platformCells = SHOPFRONT_PLATFORMS.map(p => {
        const fl = floorOf(s, p.k);
        const ok = price >= fl;
        const fee = feeFor(p.k);
        const afterFee = price * (1 - fee);
        const profit = afterFee - s.cogs - (s.shipping||0) - (s.handling||0);
        const required = 3 * s.cogs;
        return `<td><div class="pp-cell">
          <span class="pill ${ok?'p-g':'p-r'}">${ok?'Clears':'Below'} floor ${cur(fl)}</span>
          ${isAdmin() ? `<span class="pp-sub">Fee ${(fee*100).toFixed(0)}% · Profit ${cur(profit)} (need ${cur(required)})</span>` : ''}
        </div></td>`;
      }).join('');
      return `<tr><td><b>${esc(s.name)}</b></td><td class="n">${cur(price)}</td>${platformCells}</tr>`;
    }).join('') + `</tbody>`;

  const applyBox = el('promoApplyRow');
  if(!applyBox) return;
  if(!isAdmin()){ applyBox.innerHTML = ''; return; }
  applyBox.innerHTML = `<button class="btn-line sm" id="promoApplyBtn" style="margin-top:12px">Apply ${esc(promo?promo.name:'')} pricing across the stores</button>`;
  el('promoApplyBtn').addEventListener('click', () => {
    let applied = 0;
    const skipped = [];
    S.skus.forEach(s => {
      const price = Math.round(s.msrp * (1 - pct/100) * 100) / 100;
      SHOPFRONT_PLATFORMS.forEach(p => {
        const fl = floorOf(s, p.k);
        if(price >= fl){
          S.shopfrontPrices[s.id] = S.shopfrontPrices[s.id] || {};
          S.shopfrontPrices[s.id][p.k] = { price, checkedAt: new Date().toISOString().slice(0,10) };
          applied++;
        } else {
          skipped.push(`${s.name} on ${p.name}`);
        }
      });
    });
    save();
    if(typeof renderShopfrontPriceTable === 'function') renderShopfrontPriceTable();
    toast(skipped.length
      ? `Applied to ${applied} listing${applied===1?'':'s'} — skipped ${skipped.length} that would break their floor`
      : `Applied to all ${applied} listings`);
  });
}
