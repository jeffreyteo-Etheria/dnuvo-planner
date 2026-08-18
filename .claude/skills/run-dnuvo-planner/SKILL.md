---
name: run-dnuvo-planner
description: Build, run, screenshot, and drive the d.nuvo Launch Console — a static HTML/CSS/JS dashboard (no build step) with a two-step passcode gate, a KOL hub with CSV import, and an optional Netlify Live sync function. Use when asked to run the app, start the dashboard, take a screenshot of it, click through it, or verify a change actually works in the browser.
---

All paths below are relative to the repo root (`dnuvo-planner/`).

This is a static site — `index.html` + `app.js`/`kol.js`/`ui.js`/etc. loaded
as plain (non-module) `<script>` tags, no bundler, no dev server required
by the app itself. Serve it over plain HTTP with any static server and
drive it with the Playwright REPL at
`.claude/skills/run-dnuvo-planner/driver.mjs`. There is no test suite —
this driver *is* the verification path.

The app has two passcode gates before you see anything:
1. **Site gate** — `SITE_PASS` = `dnuvo2026` (app.js:14)
2. **Role gate** — Team needs no passcode; Admin needs `ADMIN_PASS` = `1234` (app.js:9)

## Prerequisites

None beyond Node.js and a way to serve static files. This was verified
with Python's built-in server, already present on this machine:

```bash
python --version   # any static server works — http.server, `npx serve`, etc.
```

## Build

There is no build step. The one thing to set up is the Playwright driver's
own isolated dependencies (kept out of the app's root `package.json` on
purpose — the app's `package.json` exists only for the Netlify function's
`@netlify/blobs` dependency, and adding a browser-automation dependency
there would contradict the "static, no build step" framing in this repo's
CLAUDE.md):

```bash
cd .claude/skills/run-dnuvo-planner
npm install
npx playwright install chromium   # no-op if already cached under %LOCALAPPDATA%\ms-playwright
```

## Run (agent path)

1. Serve the app root over HTTP (any static server; do this from the repo root):

   ```bash
   python -m http.server 8787 &
   curl -sf http://localhost:8787/index.html -o /dev/null && echo up
   ```

2. Drive it by piping commands to the REPL driver's stdin — one command
   per line, runs to completion in order, no tmux needed:

   ```bash
   node .claude/skills/run-dnuvo-planner/driver.mjs <<'EOF'
   launch
   goto http://localhost:8787
   unlock-site
   enter-team
   nav kol
   wait text=KOL hub
   ss kol-hub
   quit
   EOF
   ```

   Screenshots land in `.claude/skills/run-dnuvo-planner/screenshots/`
   (override with `SCREENSHOT_DIR`).

3. Stop the server when done:

   ```bash
   netstat -ano | grep ':8787' | grep LISTENING | awk '{print $5}' | sort -u | xargs -r -n1 taskkill //F //PID
   ```

### Commands

| command | what it does |
|---|---|
| `launch` | launch headless Chromium |
| `goto <url>` | navigate |
| `unlock-site` | fills `SITE_PASS` into `#sitePwInput`, clicks `#sitePwGo` |
| `enter-team` | clicks the Team role card (no passcode) |
| `enter-admin` | clicks Admin, fills `ADMIN_PASS`, unlocks |
| `nav <viewKey>` | clicks the sidebar item `.nav-i[data-view="<viewKey>"]` — e.g. `overview`, `kol`, `content`, `events`, `calendar`, `report` |
| `ss [name]` | full-page screenshot → `screenshots/<name>.png` |
| `click <css-sel>` | DOM `.click()` on a selector |
| `click-text <text>` | click first button/link/`[role=button]` matching text |
| `set-file <css-sel> <path>` | set a `<input type=file>`'s files (e.g. driving the KOL hub's Import CSV) |
| `fill <css-sel> <value>` | `page.fill()` |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` / `wait text=<text>` | wait up to 10s |
| `eval <js>` | evaluate in page context, print JSON (e.g. `eval S.kols.length`) |
| `text [css-sel]` | print `innerText` (body if no selector) |
| `quit` | close browser, exit |

State lives in `localStorage` under key `dnuvo_console_v1` (global `S` in
page context) — `eval S.kols.length` etc. is the fast way to check app
state without screenshotting.

## Run (human path)

Open `index.html` directly in a browser, or serve the folder and visit
it — same site/role passcodes as above. Nothing to build or compile.

## KOL hub reference

KOL hub has five stage tabs, in flow order — Creators → Content →
Budget & spend → Schedule → Confirmation
(`data-kstage="creators|content|budget|schedule|confirm"`, click via
`click [data-kstage="budget"]` etc.) — most of the selectors below only
exist once the matching tab is open. (Renamed from the earlier
`post`/`kpi` keys — Post's budget mini-summary was folded into the new
Budget & spend tab's `#kolBudgetDrilldown`, and `kpi` now holds only the
Weekly audit + long-tail panel, renamed Confirmation.)

**Creators tab — roster table (`#kolTable`) and filters (`#kolFilterBox`).**
- Filters: search, Channel, Tier, Remark, Market, **List**
  (`#kolListFilter`, only rendered once at least one custom list exists),
  Duplicates.
- **Custom lists.** A checkbox column (`.k-select`, `data-ksel="<kolId>"`)
  lets you select creators; checking any row shows a toolbar at
  `#kolSelectionBar`: `#kselCreateList` (opens a modal — fill
  `#newListName`, submit via the modal's own OK button), `#kselAddList`
  (a select, appears once ≥1 list exists, adds the current selection to
  it on `change`), `#kselClear`. With nothing selected but ≥1 list saved,
  the same container instead shows `#kselManage` — picking a list from it
  opens that list's detail/manage modal (rename, remove a member, delete
  the list). List membership renders as a small pill under the creator's
  handle in the table.
- **Duplicate Watch** (`#kolDuplicateBox`, hidden when there's nothing to
  flag) can show up to four sections: the original exact-handle-duplicate
  list; numeric-looking handles matched to a real record
  (`[data-merge-del="<idx>"]` to delete the bad one); numeric-looking
  handles with no match (informational only, no action); and same-handle
  UGC/Livestream duplicates where one side clearly has more activity
  (`[data-crosstype-del="<idx>"]` to remove the inactive copy — only
  rendered when the tool can pick a clear winner).

**Content tab.** New **Content curation** panel alongside the existing
Partnership angles / Messages panels: `#addContentItem` opens a modal
(`#ctKol` creator select, `#ctType`, `#ctLink`, `#ctNotes`, submit via the
modal's own OK button) that adds a row to `#contentTable`. Filters live at
`#contentFilterBox` (creator, status, and — once lists exist — list).

**Budget & spend tab.** `#kolBudgetDrilldown` (month's KOL channel pool
vs. named-creator commitments, 4 tiles: budget / committed / spend-paid /
headroom-or-over, then the full creator-by-creator table), `#kolActivation`
(fee/GPM/ROAS/score benchmark vs actual), `#kolPayments` (owed/deposited/
paid ledger). All read the month currently focused in Media plan
(`S.mediaFocus`) — change it via `nav media` then a `[data-mf]` click, or
`eval S.mediaFocus = <index>` for a quick test-only jump, then re-render
via `nav kol`.

**Schedule tab.** Table/Board/Calendar toggle
(`#schedViewTable`/`#schedViewBoard`/`#schedViewCal`).
- Board (`#kolSchedBoard`): filter bar above the Kanban columns —
  `#schedBoardTypeFilter` (Both / UGC only / Livestream only) and, once
  lists exist, `#schedBoardListFilter`. Each card shows a UGC/LIVE pill
  next to the creator handle. Dropping a card with no `proofLink` into
  Done is blocked for UGC creators (toast + snap back) but **allowed**
  for Livestream creators — it lands with `board:'done'` and shows
  "⚠ No proof — flagged" on the card instead of blocking.
- Calendar (`#kolSchedCal`): existing `#calFilterKol`/`#calFilterType`/
  `#calFilterStatus`, plus `#calFilterList` once lists exist.

**Confirmation tab — Weekly audit** (`#kolWeeklyAudit`). Four sections,
cutting across the whole roster regardless of which Creators sub-tab is
open: Contacted/proposed, Scheduled, Confirmed, Completed/delivered to
date. Scheduled and Confirmed rows carry a `[data-auditdone="<entryId>"]`
"Mark delivered" button — click it to flip that schedule entry straight
to Done from the audit itself (same UGC-blocks/Livestream-flags rule as
the Kanban board above). Completed rows missing a proof link render with
class `proof-missing-row` and a `.proof-warn` "⚠ missing proof" badge
instead of a link — this is intentional, not a bug, for Livestream
deliverables that have no shareable recording.

## Also new: Media plan flow (5 numbered steps) + Pricing margin control

Not KOL hub, but touched in the same session and worth knowing if a task
spans both. `nav media` now renders as an explicit 1→5 flow (each panel's
`.p-h` carries a `.step-chip` badge with its step number):
1. **Goal & month focus** — `#mediaGoalReadout` (6-month goal vs. plan
   total vs. the focused month's contribution) above the existing
   `#mediaMonthFocus` M1–M6 picker.
2. **Media budget** (`#budgetTable`) — the Budget cell per month is
   `[data-cell="month|<monthKey>|budgetOverride"]` (same contenteditable
   pattern as Units/Avg price; admin writes straight through, team creates
   a proposal). An overridden month shows
   `[data-resetbudget="<monthKey>"]` to revert to auto. **Each channel's
   dollar cell in the same row is now also contenteditable**
   (`[data-chedit="<monthKey>|<channelKey>"]`, admin-only) — editing one
   rescales the other channels proportionally so the split still sums to
   the month's total budget; this writes into the same `S.splitOverrides`
   that step 4 reads.
3. **AI-calculated ROAS & KPI** — `#mediaKpiScorecard`, a 4-tile
   auto-computed readout (target ROAS / actual ROAS logged / this month's
   budget / gates open) for whichever month is focused. No input here
   except the actual ROAS figure, entered back in step 2's table
   (`[data-actroas="<monthKey>"]`) or Reporting.
4. **Channel allocation** (`#splitSuggestion`, renamed from "Suggested
   channel split") — unchanged mechanically: admin-only `.split-pct`
   inputs, must sum to 100%, `#saveCustomSplitBtn` / `#applySplitBtn`.
5. **Schedule of the plan** (`#allocTable`, renamed from "Allocation by
   product") plus two supporting-insight panels carrying the same step-5
   chip: `#personaFindingsMedia` and `#chanBriefs`.
- **Pricing** (`nav pricing`): admin-only `#marginTargetBox` above the
  floor-formula hint — `#marginModeSel` (`costMultiple` / `netMarginPct`)
  and, when `netMarginPct` is selected, `#marginPctSel` (10/20/30). The
  simulator (`#simBox`) gained an admin-only Livestream/affiliate
  commission slider, `#simComm`.

## Verified interaction (what proves this works)

Ran the full flow above through both gates into the KOL hub, then drove
a real write path — imported a 54-row creator CSV through the actual
`#kolImportFile` input (not a mocked API call) and confirmed via
`eval S.kols.length` → `54`, plus a screenshot showing the roster table
populated and a "54 added" toast. This exercises the same
`parseCsvObjects` → dedupe-by-`type+handle` → `S.kols.push` path a real
user's import click would.

The custom-list, content-curation, duplicate-merge, budget-override, and
margin-mode features above were each separately verified the same way —
real browser, real clicks/`set-file`/`eval`, screenshots — not just read
from source. E.g. the cross-type duplicate tool was checked by seeding a
same-handle UGC+Live pair with different activity levels and confirming
the tool picked the correct one to keep before deleting the other.

## Gotchas

- **Live sync fires automatically and will 404/501 against a plain
  static server — this is expected, not a bug.** `sessions.js` turns
  Live sync on by default (`LIVESYNC.auto = true` the first time any
  browser opens the app) and both `liveSyncAutoPullOnBoot()` (on gate
  entry) and a debounced auto-push (2.5s after any `save()`, e.g. after
  a CSV import) hit `/.netlify/functions/sync`. Under
  `python -m http.server` that's a 404 on GET and a 501 ("Unsupported
  method") on POST, both logged to console but caught internally
  (`.catch(()=>{})` / try-catch) — the app never crashes or hangs on
  this. Don't chase these as real errors; only investigate a
  `[pageerror]` line, not a `[console:error] Failed to load resource`.
- **`readline` fires all buffered `line` events before an async command
  finishes** — piping a heredoc without serializing would race `goto`
  against `launch` still resolving. The driver chains commands on a
  promise queue for this reason; if you extend it, keep adding to that
  chain rather than handling a line synchronously.
- **Non-TTY stdin's `close` event fires as soon as all lines are read**,
  well before queued async commands finish — the driver guards
  `rl.prompt()`/exit against this with an `inputClosed` flag. Don't
  "simplify" this back to a plain `rl.on('line', async ...)`; that's
  the bug that produced `ERR_USE_AFTER_CLOSE`.
- **The KOL table's default view hides freshly-imported/added creators.**
  `renderKolTable()` defaults `kolViewFilter = 'default'`, which only
  shows `stage` values that map to `warmthOf() === 'confirmed' |
  'completed'`. A CSV import with no `stage` column defaults every row
  to `sourced`, so `#kolTable tbody tr` reads `0` right after a
  successful import — check `eval S.kols.length` or click the
  `[data-stage="sourced"]` pipe tile instead of assuming the table row
  count reflects the roster.
- **`chromium-cli` is not installed in this environment** (Windows /
  Git Bash, no `tmux` either) — this driver is the `_electron`-style
  fallback the parent skill-generator instructions call for, adapted
  for a regular browser page (`chromium.launch()` + `newPage()`, not
  `_electron`).
- **Playwright's Chromium cache lives outside this OneDrive-synced
  project folder** (`%LOCALAPPDATA%\ms-playwright`, confirmed present
  from a prior install) — only the small `playwright` npm package
  itself lands in this skill's `node_modules/`, not the ~300MB browser
  binary, so `npm install` here doesn't dump a large binary into
  OneDrive sync.
- **`click-text` is ambiguous whenever a button's label appears both on
  the page and inside an open modal** — e.g. "Add creator" is both the
  sidebar button that opens the modal *and* the modal's own submit
  button. `click-text` clicks the first DOM match, which can silently be
  the page's button (reopening/resetting the modal) instead of the one
  that submits it. For any modal opened through this app's shared
  `modal()` helper, submit with `#modalFoot [data-act="ok"]` instead
  (Cancel is `[data-act="x"]`, a destructive confirm is `[data-act="del"]`)
  — that targets the modal's own footer, never the page behind it.
- **File-driven state changes need a beat before you read the result.**
  `set-file` on a hidden `<input type=file>` (Import CSV, etc.) kicks off
  an async `FileReader` read + parse; `eval S.kols.length` run immediately
  after can still read the pre-import value. Either `wait` on the
  resulting toast/element, or add `eval new Promise(r=>setTimeout(r,300))`
  before reading state.

## Troubleshooting

- **`ERROR: launch first` on every command, immediately, before `launch`
  even prints `launched`:** you're piping a heredoc into a driver
  version without the promise-queue fix — commands are running out of
  order. Confirm `driver.mjs` chains `line` handling through a shared
  `queue` promise (see Gotchas above).
- **`Error [ERR_USE_AFTER_CLOSE]: readline was closed`:** same root
  cause — the `close` handler tried to `rl.prompt()`/re-quit after
  stdin's `close` event already fired mid-queue. Confirm the
  `inputClosed`/`exiting` guards are present.
- **`curl: (7) Failed to connect` after starting the static server:**
  give it a beat — `until curl -sf ... ; do sleep 1; done` rather than
  a fixed `sleep`, though in practice `python -m http.server` was ready
  well under a second in testing.
- **Port already in use on 8787:** find and kill the old listener first
  — `netstat -ano | grep ':8787' | grep LISTENING` then
  `taskkill //F //PID <pid>` (Windows; no `lsof`/`fuser` here).
