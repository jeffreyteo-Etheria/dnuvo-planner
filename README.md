# d.nuvo — Launch Console

A role-gated strategy and execution dashboard for a six-month product launch.
Static site. No build step, no server, no dependencies.

## Deploy

**Netlify drop** — go to https://app.netlify.com/drop and drag this folder on. Live in under a minute.

**Netlify via Git** — build command blank, publish directory `.`

## Access

| Role | How to enter | Sees |
|---|---|---|
| **Team member** | Click the card, no passcode | Overview, Strategy, Pricing, Media plan, KOL hub, Events, Calendar, Reporting |
| **Administrator** | Passcode `1234` | Everything above, plus Approvals, cost data, and all editable fields |

Change the passcode at the top of `app.js` — `const ADMIN_PASS = '1234'`.

> This is a workspace gate, not security. Anyone can read `app.js`. It separates
> responsibilities between colleagues; it does not protect against an adversary.
> Do not put anything genuinely confidential in the cost fields if the site is public.

## How cost is hidden from the team

Cost per unit drives the floor price, but the team never needs the cost itself — only
the floor. So the console computes the floor and the maximum safe discount, then shows
those, and masks the cost column with `••••`.

The discount simulator still works fully for the team: they can model any promotion on
any platform and see whether it clears the floor, by how much, and request approval if
it does not. They simply never see the input that produced the floor.

Administrators see cost, floor, margin per unit and profit throughout.

## Approval workflow

1. A team member hits something they cannot change — a price below the floor, a media
   budget they disagree with.
2. They click **Request a change**, which captures the area, the current value, the
   proposed value and the reasoning.
3. The request appears in **Approvals** with a count badge on the admin sidebar.
4. The admin approves or declines. Approved changes are then applied in the relevant view.

## KOL workflow (superseded — see below)

**Source → Contact → Ship → Post → Complete.** Click any pipeline stage to filter the roster.

**Researching a creator.** Enter a handle, pick the platform and the AI tool, and the console
builds a prompt. Copy it, paste it into ChatGPT, Copilot or Gemini, and bring the answer back.

The prompt is written to refuse invention. It instructs the tool to write `NOT VERIFIED`
rather than estimate, to attach a source URL to every number, to stop rather than substitute
a similar account, and to say plainly when most fields cannot be confirmed — which is the
signal to check the creator's storefront and marketplace affiliate pages by hand instead.

The add-creator form carries the same discipline: leave a field blank when you could not
verify it. Blank fields render as *not verified* in the roster, so nobody downstream mistakes
a gap for a measurement.

**Apify scraping** is administrator-only. Paste a scrape result as JSON and the form pre-fills;
absent fields stay empty.

**Outreach messages.** Eight templates covering the full arc — first approach, follow-up,
confirmation and brief, shipping, day 14, day 30 with usage rights, live session booking,
and wrap-up. Pick a creator and a stage, and the message fills with their name, platform,
product and a generated discount code. Each one tells you what to do after sending.

## The gate rail

The strip under the header is the spine of the plan. Five locks, each holding back a
capability until its condition is met:

| Gate | Target | Unlocks |
|---|---|---|
| Reviews | 50 on the hero product | Paid advertising |
| Rating | 4.7★ | Marketplace flash deals |
| Return | 1.5× blended | Budget scale-up |
| Audience | 1,000 retargetable | Social retargeting |
| Buyers | 200 past purchasers | Premium ritual sets |

It fills from the actuals you enter in Reporting. Hover any node for the reasoning.
This is the mechanism that stops the most common failure — spending on ads before
there is anything for a buyer to trust.

## Pricing model

Masstige positioning: hold price, compete on proof. Three tiers across three platforms.

- **Shopify** carries full MSRP and protects the anchor. Value moves through order-size
  incentives, never sitewide percentage cuts.
- **Shopee** matches the listed price and discounts only through vouchers, so the sticker
  price stays intact.
- **TikTok Shop** matches the page price and puts the deal inside the live room, time-boxed.

The floor formula is cost × 2.5, grossed up for platform commission, plus processing.
The simulator checks any proposed discount against it before it goes live.

## Media allocation

The budget engine runs `base + (previous month profit × reinvest %)`, and the channel
split phases in as the plan matures — month one is entirely creator gifting, retargeting
does not appear until month four.

**Allocation by product** then names every dollar to a specific product or bundle with its
ad format and success measure, so a monthly figure is never just a channel total.



## Proposed changes (team → admin)

A team member editing a figure **does not change it**. The edit is captured as a proposal
against that exact cell and the live value stays exactly as it was.

- The team member sees their proposal beside the value: `S$35 → S$28`, marked as waiting.
- An administrator sees an **amber pulsing flag** next to the live figure. Clicking it opens
  a side-by-side: *current, which stays if you keep it* against *proposed by the team*.
- The administrator either **approves** (applies it) or **keeps current** (discards it, with
  an optional note back to the team).

Editing the same cell again supersedes the earlier proposal, so there is never a queue of stale
numbers against one field. Everything — approved, kept, superseded — stays in **Pending changes**
as an audit trail, and **Show me where** scrolls to the cell and flashes the row.

Price proposals carry a floor check into the decision, so an administrator is told plainly
when approving something would mean selling below cost.

Fields the team may propose against are listed in `PROPOSABLE` in `data.js` — sale price,
bundle price, shop handle, shop URL, monthly units and average price. Everything else,
including cost, is admin-only and not editable from the team view at all.

## Shop links

Pricing → **Shop links** connects each product and bundle to its page on the store.

Set the domain and path pattern once (defaults to `https://dnuvo.com.sg` and `/products/`),
then give each item its handle — the last part of its address. `↗ shop` links then appear
throughout the price book.

**Check** opens the page in a new tab and asks you to confirm it loaded, recording the result
as Checked or Not found. A browser cannot inspect another site's pages on your behalf, so this
is a human confirmation rather than an automated one — and an item with no handle stays blank
rather than being given an address that may not exist.

## Sessions

A **session** is a named snapshot of the entire plan — pricing, budget, creators, approvals,
progress and notes. Open **Sessions** in the header, or press `⌘S`.

Save one before any significant change. Restoring offers to snapshot your current work first,
so you can never lose a plan by loading another. Sessions can be duplicated, downloaded as
`.json`, and imported from a file — which is how you hand a plan to a colleague without a server.

## GitHub sync

Optional. Stores the current plan and every session in a **private gist on your own GitHub
account** — there is no server of ours in between.

1. GitHub → Settings → Developer settings → Personal access tokens (classic)
2. Generate a token with **only the `gist` scope** ticked
3. Paste it into Sessions → GitHub sync, leave the Gist ID blank, and press **Push**

The gist is created on first push and its ID saved. **Pull** brings the plan back on another
machine. Tick *push automatically* to sync whenever a session is saved.

The token is held in that browser and transmitted only to github.com. A gist is readable by
anyone you share its URL with, including cost figures — keep it private.

## Downloading

**Per table.** Every table has a `↓` in its header for CSV, Markdown or JSON.

**Per section or everything.** Sessions → Download. Twelve sections individually, or the whole
plan as one Markdown or JSON file.

**As slides.** Use **Export view** in the header. It prints the section you are looking at at
A4 landscape, which drops into PowerPoint or Google Slides without reformatting.

CSV opens in a spreadsheet. Markdown pastes into Notion, Docs or a deck. JSON feeds another tool.

Exports respect the access boundary: a team member's export contains no cost or profit column.

## Interaction

| Shortcut | Does |
|---|---|
| `⌘K` / `Ctrl K` | Command palette — jump anywhere, run anything |
| `⌘S` / `Ctrl S` | Save a session |
| `1` – `8` | Jump to a section |
| `?` | Shortcut list |
| `Esc` | Close whatever is open |

Column headings sort. Pipeline stages filter the creator roster. Channel briefs expand and
collapse. The gate rail is hoverable for the reasoning behind each lock.

## Role-based operating guide

Keep usage simple: each role should enter, complete its own section, then hand off with a session save.

### Media planner

1. Start in **Media plan** and update month budgets only after checking gate status in Overview.
2. Use **Allocation by product** so every spend line is attached to a SKU or bundle.
3. Open **Reporting** monthly and enter actuals to unlock the next gate in sequence.
4. Save a session named `M{month} media review` before changing channel splits.

### Social / KOL manager

1. Work from **KOL hub** using stage flow: source, contact, ship, post, complete.
2. For every creator, log only verified metrics; leave unknown fields blank.
3. Use the prompt builder for verified-data collection and attach source links in notes.
4. Send approvals for fee, pricing, or discount exceptions through request flow only.

### Event and retail lead

1. Manage cadence in **Events** and **Calendar** first, then coordinate promo windows with KOL posts.
2. Keep event timing aligned to gates: avoid major live pushes before trust proof gates are open.
3. Track post-event impact in **Reporting** within the same month close.

### Content creative manager

1. Use **Strategy** and **Pricing** to lock message hierarchy before asset production.
2. Build content variants by channel objective: proof, conversion, retention.
3. Match each creative batch to one monthly KPI and one gate outcome.
4. Save snapshots before replacing core copy angles.

### Administrator

1. Review **Pending changes** and **Approvals** daily.
2. Approve only changes that preserve floor price and gate sequence logic.
3. Keep cost edits, floor assumptions, and target shifts documented in session notes.
4. Publish a monthly "decision snapshot" session as the single source of truth.

## Competitor intelligence baseline (ceramide / barrier)

Use this as a planning baseline for the KOL team. Revalidate weekly in-market because prices move with campaigns.

| Competitor | Product reference | Observed price signal | Messaging pattern |
|---|---|---|---|
| **CeraVe** | Moisturizing Cream | US PDP shows **$14.99** | 3 essential ceramides, barrier restore, MVE delivery, dermatologist-developed |
| **Cetaphil** | Moisturizing Lotion | Price varies by retailer | 48-hour hydration, barrier restoration in 1 week, sensitive-skin safety |
| **COSRX** | Balancium Comfort Ceramide Cream 80g | Watsons SG: **S$31.68** promo / S$35.20 list | Comfort barrier care, soothing, K-beauty credibility |
| **CERADAN** | Ceramide Daily Moisturising Cream 500g | Watsons SG: **S$36.70** promo / S$45.90 list | Clinical ceramide care, family-safe daily moisturising |
| **ILLIYOON** | Green Tea / Ceramide Ato line references | Watsons SG ceramide line often around **S$12-S$25** items | Gentle barrier support, daily maintenance |
| **Suu Balm** | Ceramide Moisturiser line | Watsons SG: **S$20.74** (75ml promo) to **S$54.10** (350ml) | Itch relief + ceramide, problem-solution framing |

Sources used for baseline capture: CeraVe PDP, Cetaphil PDP, and Watsons SG ceramide listing pages.

## Market gaps and opportunity framing for d.nuvo

1. Most competitors over-index on generic hydration language; d.nuvo can own deeper-delivery education.
2. Few brands combine premium-science explanation with creator-friendly conversion hooks in one system.
3. Marketplace promotions are frequent; differentiation must come from mechanism proof and structured storytelling, not pure discount depth.

Recommended message stack for KOL and content teams:

1. Emotional: **Your skin deserves ingredients that go deeper.**
2. Educational: **Stop moisturizing the surface. Start feeding the layers.**
3. Credibility: **15x deeper (or validated benchmark), not a claim - a patented system.**
4. Differentiation: **A ceramide delivery system designed for absorption plus repair, not surface coating.**

Only publish numeric claims when the exact legal-approved evidence pack is attached.

## 6-month coordinated platform push (long-tail)

### Shopee

1. Role: conversion and repeat purchase engine.
2. Months 1-2: seed reviews, FAQ optimization, voucher-led basket building.
3. Months 3-4: bundle scaling and retargeting once trust gates clear.
4. Months 5-6: repeat-buyer packs and event-linked conversion spikes.

### TikTok Shop

1. Role: discovery and creator proof loop.
2. Months 1-2: education-heavy UGC and mechanism explainers.
3. Months 3-4: live selling tied to proven hooks, not first-touch discounting.
4. Months 5-6: creator clusters by audience segment and replay-driven conversion.

### Shopify

1. Role: brand authority and full-funnel capture.
2. Months 1-2: science story, ingredient pages, and trust assets.
3. Months 3-4: bundle landing pages and email/SMS remarketing flows.
4. Months 5-6: loyalty and routine-system upsell to increase LTV.

### Lazada

1. Role: incremental reach and campaign-event participation.
2. Months 1-2: SKU hygiene and PDP consistency.
3. Months 3-4: campaign calendar integration with retail moments.
4. Months 5-6: value-set offers while preserving core MSRP architecture.

## Adapting to another brand or market

Everything the console renders comes from `data.js`. Edit that one file:

`DEFAULTS` market and currency · `SKUS` products and costs · `BUNDLES` · `TIERS` and
`CHAN_LOGIC` pricing architecture · `GATES` thresholds · `MONTHS` targets and splits ·
`ALLOC` per-product weights · `CRM_MSGS` outreach copy · `EVENTS` · `WEEKS` · `METRICS`

Nothing in `app.js` needs to change.

## Data

Everything saves to the browser it was entered in. Move a plan between people or machines
with a session file or GitHub sync. There is still no shared server — two people editing at
once will not see each other's work live; the last one to push wins.

## KOL hub

### Two rosters, judged differently

| | UGC creator | Livestream creator |
|---|---|---|
| Earns | Reviews and reusable content | GMV in real time |
| Measured on | Review density, authenticity | **GPM** — GMV per thousand views |
| Fields | Followers, engagement, posts, rate | Avg views, avg GMV, GPM, retention, fee |
| Gate before paying | Verified figures | The 10-point fit check |

Switch rosters at the top of the KOL hub. Each has its own pipeline counts, table columns and
message list.

### GPM and the fit check

`GPM = (Total GMV ÷ Total views) × 1,000`. Enter average views and average GMV and it calculates;
enter a known GPM and that wins. Bands: **$511+ elite**, **$300+ solid**, **$200+ testable**,
below that unproven.

**Fit** on a livestream creator opens the 10-factor Tick & Check. The score picks the fee scenario:

| Ticks | Scenario | Terms | Break-even GMV |
|---|---|---|---|
| 0–4 | Commission only | 25% only | — |
| 5–7 | Test | S$200 + 25% | S$625 |
| 8–9 | Balanced | S$1,500 + 25% | S$4,688 |
| 10 + verified GPM | Mega | S$8,000 + 25% | S$25,000 |

Two guards the guide insists on are enforced rather than advisory:

- **Ingredient IQ** and **Real Skin** are marked critical. If either is unticked the terms drop to
  commission-only whatever the score — a 9/10 creator who films through heavy filters cannot buy
  their way to a fixed fee.
- **Mega** additionally requires GPM verified at $511+. Ten ticks with an unproven GPM caps at Balanced.

**On break-even.** The guide's published figures ($625 / $4,688 / $25,000) do not equal
fee ÷ 25%; they equal **fee ÷ 32%**. So a fee is recovered out of roughly 32c of contribution in
each GMV dollar, not out of the commission line. The console derives break-even from `BE_MARGIN`
in `data.js` and states the assumption on screen, so a changed fee updates the figure and nobody
reads a stale number. If the real margin on the bundle being sold is thinner, break-even rises —
check it before agreeing terms.

### What the team can and cannot do

Team members have **full access** to add creators, run fit checks, schedule, and send messages.

Records lock at **Approved** and stay locked through Scheduled, Delivering, Complete and Declined.
At that point a team member can still move the record forward and edit notes, but cannot delete it
or edit agreed terms — spend and deliverables trace back to it. Only an administrator can remove a
locked record or move one back out of an approved stage. Trying to delete one explains why rather
than just refusing.

### Scheduling

**Schedule** on any creator books a deliverable — Day 0/14/30 and store review for UGC, live
sessions and promo posts for livestream. The schedule flags overdue items and exports to **.ics**,
per event or the whole thing, so it drops into Google Calendar, Outlook or Apple Calendar.

### Sending

Pick a creator, a message and a route:

- **My email** — opens your mail app addressed to them, subject and body filled
- **TikTok inbox · Shopee chat · Instagram DM** — copies the message and opens that inbox
- **Copy** or **Download as .txt**

Every send is logged and moves a Sourced creator to Contacted automatically. Livestream messages
fill the fee placeholder from the fit assessment, so the terms you offer match the terms the
checklist justified.

