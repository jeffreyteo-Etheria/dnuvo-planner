/* ════════════════════════════════════════════════
   Market personas — synthetic-persona interview tool
   Reuses the same 3 brand-ambassador characters as the
   Content module's image/video persona (BRAND_PERSONAS,
   data.js), but here they're a consumer-research lens:
   build a role-play prompt, run it in an external AI tool
   (no API key ever touches this static site — same
   copy-then-open pattern as Content's openAiTool), paste
   the answer back, and route it to Content or Media.
   Answers are directional/qualitative proxy research, not
   verified consumer data — never a sourced claim.
   ════════════════════════════════════════════════ */

/* d.nuvo's approved messaging stack (CLAUDE.md) — included in every prompt
   so the persona reacts to what the brand actually says, and any content/
   marketing-angle suggestion it produces stays inside approved claims
   rather than freelancing a new one. */
const DNUVO_MESSAGING_STACK = [
  'Emotional: "Your skin deserves ingredients that go deeper."',
  'Educational: "Stop moisturizing the surface. Start feeding the layers."',
  'Credibility: a patented delivery system — described in mechanism terms, not with an unapproved number.',
  'Differentiation: a ceramide delivery system designed for absorption plus repair.'
].join('\n');

function buildPersonaInterviewPrompt(personaId, question){
  const p = BRAND_PERSONAS.find(x => x.id === personaId) || BRAND_PERSONAS[0];
  const mp = p.marketProfile || {};
  const q = (question || '').trim() || 'What would make you switch to a new skincare brand?';
  return `ROLE-PLAY BRIEF — answer AS this synthetic consumer persona, not as an AI assistant. Purpose: surface a real-world-plausible reaction that a marketing or content team can act on — which angle to lead with, which claim to drop, which trend actually lands with this person. This is qualitative proxy research to pressure-test messaging and positioning before real primary research or paid media spend — be honest and critical, do not flatter the brand.

PERSONA
Name: ${p.name} — "${p.archetype}"
Age / hometown: ${p.age}, ${p.hometown}
Lifestyle: ${mp.lifestyle || '—'}
Current skincare regime: ${mp.skincareRegime || '—'}
Price sensitivity: ${mp.priceSensitivity || '—'}
What actually drives a purchase for her: ${mp.purchaseDrivers || '—'}
Channel habits: ${mp.channelHabits || '—'}
Real skin condition: ${p.skinCondition}
Voice: ${p.tone}

BRAND BEING TESTED
d.nuvo — ceramide/barrier-repair skincare, masstige pricing, competing against CeraVe, Cetaphil, COSRX, CERADAN, ILLIYOON and Suu Balm.

d.nuvo's approved messaging stack — react to these specific lines, don't invent a new claim to react to:
${DNUVO_MESSAGING_STACK}

QUESTION TO ANSWER IN CHARACTER
"${q}"

RULES
- Answer only as ${p.name} would — her lifestyle, budget and skepticism, not a generic "ideal customer."
- Be critical where a real consumer would be, reflecting how someone like her actually behaves and talks online today — not an idealized customer.
- Ground the answer in the facts given above (her profile, the approved messaging stack) — do not invent specific statistics, study results, or competitor claims that weren't stated. If a claim above is unproven, react to it as unproven, in character.
- Close with one line naming the specific content or marketing angle (a hook, a proof point, a format) that this answer suggests — that's the part a marketer will act on.
- If you would genuinely be unsure or need more information before deciding, say so — that is a useful answer too.
- Keep the answer to a few honest paragraphs, not a marketing pitch.`;
}

/* Starter questions are per-persona (PERSONA_QUESTION_STARTERS, data.js),
   not a shared generic list — each set is written to that persona's own
   decision pattern, so refresh the options whenever the persona changes. */
function renderPersonaStarters(){
  const starterSel = el('mpStarter'); if(!starterSel) return;
  const personaId = (el('mpPersona')||{}).value || BRAND_PERSONAS[0].id;
  const list = PERSONA_QUESTION_STARTERS[personaId] || [];
  starterSel.innerHTML = `<option value="">— or pick a starter question —</option>` +
    list.map(q => `<option value="${esc(q)}">${esc(q)}</option>`).join('');
}

function renderPersonas(){
  const cardsBox = el('mktPersonaCards');
  if(cardsBox){
    cardsBox.innerHTML = `<div class="pf-grid">${BRAND_PERSONAS.map(p => {
      const mp = p.marketProfile || {};
      return `<div class="pf-card">
        <div class="pf-h"><b>${esc(p.name)}</b><span class="pill p-v">${esc(p.archetype)}</span></div>
        <div class="pf-meta">${esc(p.age)} · ${esc(p.hometown)}</div>
        <p><b>Lifestyle:</b> ${esc(mp.lifestyle||'—')}</p>
        <p><b>Regime:</b> ${esc(mp.skincareRegime||'—')}</p>
        <p><b>Price sensitivity:</b> ${esc(mp.priceSensitivity||'—')}</p>
        <p><b>Buys because:</b> ${esc(mp.purchaseDrivers||'—')}</p>
        <p><b>Channels:</b> ${esc(mp.channelHabits||'—')}</p>
      </div>`;
    }).join('')}</div>`;
  }

  const personaSel = el('mpPersona');
  if(personaSel && !personaSel.options.length){
    personaSel.innerHTML = BRAND_PERSONAS.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(p.archetype)}</option>`).join('');
  }
  renderPersonaStarters();

  renderPersonaAnswerTable();
  renderPersonaFindings('content', 'personaFindingsContent');
  renderPersonaFindings('media', 'personaFindingsMedia');
}

function renderPersonaAnswerTable(){
  const box = el('mpAnswerTable'); if(!box) return;
  const rows = (S.personas.answers || []).slice().sort((a,b) => b.date.localeCompare(a.date));
  if(!rows.length){ box.innerHTML = ''; return; }
  const destLabel = { content:'Content strategy', media:'Media plan', log:'Log only' };
  box.innerHTML = `<thead><tr><th>Date</th><th>Persona</th><th>Question</th><th>Answer</th><th>Routed to</th><th></th></tr></thead><tbody>` +
    rows.map(r => `<tr>
      <td class="n">${esc(r.date)}</td>
      <td><b>${esc(r.personaName||r.persona)}</b></td>
      <td>${esc(r.question||'—')}</td>
      <td style="max-width:320px;color:var(--mute)">${esc(r.answer)}</td>
      <td><span class="pill p-n">${esc(destLabel[r.dest]||'Log only')}</span></td>
      <td><button class="btn-line sm danger" data-mpdel="${r.id}">Remove</button></td>
    </tr>`).join('') + `</tbody>`;
  qsa('[data-mpdel]', box).forEach(b => b.addEventListener('click', () => {
    S.personas.answers = S.personas.answers.filter(x => x.id !== b.dataset.mpdel);
    save(); renderPersonas();
  }));
}

/* Read-only reference list rendered inside Content and Media views —
   propagation destination for a logged answer, filtered by `dest`. */
function renderPersonaFindings(dest, elId){
  const box = el(elId); if(!box) return;
  const rows = (S.personas.answers || []).filter(r => r.dest === dest);
  const destName = dest === 'content' ? 'Content strategy' : 'Media plan';
  if(!rows.length){
    box.innerHTML = `<p class="empty">Nothing routed here yet — log an answer in <b>Market personas</b> and send it to ${esc(destName)}.</p>`;
    return;
  }
  box.innerHTML = `<div class="bp-tactics">${rows.map(r => `
    <div class="bp-t"><b>${esc(r.personaName||r.persona)} — ${esc(r.date)}</b>
      <p>${r.question ? `"${esc(r.question)}" — ` : ''}${esc(r.answer)}</p></div>`).join('')}</div>`;
}

const mpStarterSel = el('mpStarter');
if(mpStarterSel) mpStarterSel.addEventListener('change', () => {
  if(mpStarterSel.value) el('mpQuestion').value = mpStarterSel.value;
});
const mpPersonaSel = el('mpPersona');
if(mpPersonaSel) mpPersonaSel.addEventListener('change', () => {
  renderPersonaStarters();
  el('mpQuestion').value = '';
});
const mpBuildBtn = el('mpBuildBtn');
if(mpBuildBtn) mpBuildBtn.addEventListener('click', () => {
  const question = el('mpQuestion').value;
  if(!question.trim()){ toast('Type or pick a question first'); return; }
  const txt = buildPersonaInterviewPrompt(el('mpPersona').value, question);
  el('mpPromptText').textContent = txt;
  el('mpPromptOut').hidden = false;
  el('mpPromptOut').scrollIntoView({behavior:'smooth', block:'nearest'});
});
const mpCopyBtn = el('mpCopyBtn');
if(mpCopyBtn) mpCopyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(el('mpPromptText').textContent)
    .then(()=>toast('Prompt copied — paste it into your research tool'))
    .catch(()=>toast('Select the text and copy manually'));
});
[['mpOpenPerplexity','perplexity','Perplexity'],['mpOpenChatgpt','chatgpt','ChatGPT']].forEach(([id,key,label]) => {
  const b = el(id);
  if(b) b.addEventListener('click', () => openAiTool(key, label, el('mpPromptText').textContent));
});
const mpSaveBtn = el('mpSaveBtn');
if(mpSaveBtn) mpSaveBtn.addEventListener('click', () => {
  const answer = el('mpAnswer').value.trim();
  if(!answer){ toast('Paste an answer before saving'); return; }
  const personaId = el('mpPersona').value;
  const persona = BRAND_PERSONAS.find(p => p.id === personaId);
  S.personas.answers.push({
    id: 'P'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    persona: personaId,
    personaName: persona ? persona.name : personaId,
    question: el('mpQuestion').value.trim(),
    answer,
    dest: el('mpDest').value,
    date: new Date().toISOString().slice(0,10)
  });
  save();
  el('mpAnswer').value = '';
  toast('Answer logged');
  renderPersonas();
});
