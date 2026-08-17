// REPL driver for the d.nuvo Launch Console (static HTML/CSS/JS dashboard).
// Reads line commands from stdin, one per line — pipe a heredoc for a
// one-shot batch (like chromium-cli), or run interactively.
//
// Usage:
//   node .claude/skills/run-dnuvo-planner/driver.mjs <<'EOF'
//   launch
//   goto http://localhost:8787
//   unlock-site
//   enter-team
//   wait text=Overview
//   ss 01-overview
//   quit
//   EOF
//
// Screenshots land in SCREENSHOT_DIR (default: .claude/skills/run-dnuvo-planner/screenshots/).

import { chromium } from 'playwright';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SHOT_DIR = process.env.SCREENSHOT_DIR || path.join(import.meta.dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const SITE_PASS = 'dnuvo2026';
const ADMIN_PASS = '1234';

let browser = null;
let page = null;

const COMMANDS = {
  async launch() {
    if (browser) return console.log('already launched');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', msg => { if (msg.type() === 'error') console.log('[console:error]', msg.text()); });
    page.on('pageerror', err => console.log('[pageerror]', err.message));
    console.log('launched');
  },

  async goto(url) {
    if (!page) return console.log('ERROR: launch first');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log('goto', url, '→ ok');
  },

  // App-specific: types SITE_PASS into the first gate and unlocks it.
  async 'unlock-site'() {
    if (!page) return console.log('ERROR: launch first');
    await page.fill('#sitePwInput', SITE_PASS);
    await page.click('#sitePwGo');
    await page.waitForSelector('#gate:not([hidden])', { timeout: 5000 });
    console.log('unlock-site → ok, role gate visible');
  },

  // App-specific: picks the Team role (no passcode needed).
  async 'enter-team'() {
    if (!page) return console.log('ERROR: launch first');
    await page.click('.gate-role[data-role="team"]');
    await page.waitForSelector('#app:not([hidden])', { timeout: 5000 });
    console.log('enter-team → ok, app visible');
  },

  // App-specific: picks Admin, fills ADMIN_PASS, unlocks.
  async 'enter-admin'() {
    if (!page) return console.log('ERROR: launch first');
    await page.click('.gate-role[data-role="admin"]');
    await page.fill('#pwInput', ADMIN_PASS);
    await page.click('#pwGo');
    await page.waitForSelector('#app:not([hidden])', { timeout: 5000 });
    console.log('enter-admin → ok, app visible');
  },

  // Click the sidebar nav item for a given view (data-view attr), e.g. "kol".
  async 'nav'(viewKey) {
    if (!page) return console.log('ERROR: launch first');
    const sel = `.nav-i[data-view="${viewKey}"]`;
    const r = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK';
    }, sel);
    console.log('nav', viewKey, '→', r);
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f, fullPage: true });
    console.log('screenshot:', f);
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK';
    }, sel);
    console.log('click', sel, '→', r);
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, a, [role="button"]')];
      const el = els.find(e => e.textContent?.trim() === t)
              ?? els.find(e => e.textContent?.includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName;
    }, text);
    console.log('click-text', JSON.stringify(text), '→', r);
  },

  async 'set-file'(rest) {
    if (!page) return console.log('ERROR: launch first');
    const sp = rest.indexOf(' ');
    const sel = sp === -1 ? rest : rest.slice(0, sp);
    const filePath = sp === -1 ? '' : rest.slice(sp + 1);
    await page.setInputFiles(sel, filePath);
    console.log('set-file', sel, filePath, '→ ok');
  },

  async fill(rest) {
    if (!page) return console.log('ERROR: launch first');
    const sp = rest.indexOf(' ');
    const sel = sp === -1 ? rest : rest.slice(0, sp);
    const val = sp === -1 ? '' : rest.slice(sp + 1);
    await page.fill(sel, val);
    console.log('fill', sel, '→ ok');
  },

  async type(text) { if (page) await page.keyboard.type(text, { delay: 20 }); },
  async press(key) { if (page) await page.keyboard.press(key); },

  async wait(target) {
    if (!page) return console.log('ERROR: launch first');
    try {
      if (target.startsWith('text=')) {
        await page.waitForSelector(`text=${target.slice(5)}`, { timeout: 10_000 });
      } else {
        await page.waitForSelector(target, { timeout: 10_000 });
      }
      console.log('found:', target);
    } catch { console.log('TIMEOUT:', target); }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null));
  },

  async quit() { if (browser) await browser.close().catch(() => {}); browser = null; page = null; },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'driver> ' });

// readline fires 'line' for every buffered line back-to-back, without
// waiting for an async handler to finish — piping a heredoc would race
// every command against `launch` still resolving. Chain them so each
// command only starts once the previous one has fully completed. Piped
// (non-TTY) stdin also fires 'close' as soon as all lines are read, well
// before the queued async commands are done — guard prompt/exit against
// that instead of assuming 'close' means "everything already ran."
let queue = Promise.resolve();
let inputClosed = false;
let exiting = false;
async function runLine(line) {
  const trimmed = line.trim();
  if (!trimmed) { if (!inputClosed) rl.prompt(); return; }
  const sp = trimmed.indexOf(' ');
  const cmd = sp === -1 ? trimmed : trimmed.slice(0, sp);
  const arg = sp === -1 ? '' : trimmed.slice(sp + 1);
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '— try: help'); if (!inputClosed) rl.prompt(); return; }
  try { await fn(arg); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { exiting = true; process.exit(0); return; }
  if (!inputClosed) rl.prompt();
}
rl.on('line', line => { queue = queue.then(() => runLine(line)); });
rl.on('close', () => {
  inputClosed = true;
  queue = queue.then(async () => { if (exiting) return; await COMMANDS.quit(); process.exit(0); });
});

console.log('dnuvo-planner driver — "help" for commands, "launch" to start');
rl.prompt();
