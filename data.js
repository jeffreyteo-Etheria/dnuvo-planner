/* ════════════════════════════════════════════════
   d.nuvo Launch Console — plan data
   Edit here to re-point the console at another
   brand or market. Everything else reads from this.
   ════════════════════════════════════════════════ */

const DEFAULTS = {
  brand: 'd.nuvo',
  market: 'Singapore',
  cur: 'S$',
  goalUnits: 3000,
  baseBudget: 10000,
  marginPct: 40,
  reinvestPct: 30,
  startMonth: 'August 2026',
  shopDomain: 'https://shop.dnuvo.com.sg',
  shopPath: '/products/',      // Shopify default. Change if the store uses another pattern.
  aiToolLinks: { higgsfield:'https://higgsfield.ai', maxfusion:'', gemini:'https://gemini.google.com' },
  socialHandles: { shopee:'shopee.sg/d.nuvo', tiktok:'@d.nuvo_official', shopify:'shop.dnuvo.com.sg' },
  platformsActive: { tiktok:true, instagram:true, facebook:false, shopee:true, lazada:false, shopify:true },
  competitorUrls: [],
  promoPeriods: {},
  // How the floor price's required profit is set. 'costMultiple' (default,
  // unchanged from before this setting existed) targets 3x cost-of-goods
  // as profit. 'netMarginPct' instead targets marginTargetPct as a share of
  // net proceeds after the platform fee — a common way skincare D2C brands
  // frame margin, but 20% here is a general industry starting point, not a
  // verified benchmark for this brand specifically. Admin-only to change.
  marginTargetMode: 'costMultiple',
  marginTargetPct: 20
};

/* ── Kanban columns for the KOL schedule. Separate from `done` (which
   still drives the existing table view's done/late styling) — this is
   a genuine status progression a creator deliverable moves through. ── */
const SCHED_BOARD = [
  { k:'planned',   name:'Planned' },
  { k:'confirmed', name:'Confirmed' },
  { k:'live',      name:'Live' },
  { k:'done',      name:'Done' }
];

/* ── Best-practice posting windows per platform — a starting point to
   verify against the creator's own audience-activity data, not a
   guarantee. Times are local to the audience's own timezone.       ── */
const POSTING_TIMES = {
  'TikTok':          ['7–9pm', '12–1pm lunch scroll'],
  'Instagram':       ['12–1pm', '7–9pm'],
  'YouTube':         ['2–4pm weekdays', '9–11am weekends'],
  'Shopee Live':     ['8–10pm (peak live-shopping window)'],
  'Xiaohongshu':     ['8–10pm', '12–1pm']
};

/* ── Structured promo-period catalog. Campaign setup marks which of
   these apply and to which month; media plan and calendar both read
   from that single source instead of separate free-text fields.  ── */
const PROMO_PERIODS = [
  { k:'bau',     name:'BAU (always-on)',   mechanicNote:'Full price, always-on voucher — the floor-safe default.', discountPct:0 },
  { k:'payday',  name:'Payday window',     mechanicNote:'Late-month spend spike — align voucher pushes with SG payday cycles.', discountPct:10 },
  { k:'flash',   name:'Custom flash sale', mechanicNote:'Short, time-boxed live/marketplace mechanic — never below the price floor.', discountPct:20 },
  { k:'9.9',     name:'9.9 Mega Sale',     mechanicNote:'Marketplace mega-sale — heavier Shopee/TikTok weighting converts better.', discountPct:20 },
  { k:'10.10',   name:'10.10',             mechanicNote:'Secondary marketplace moment — smaller than 9.9/11.11, still worth a bundle push.', discountPct:15 },
  { k:'11.11',   name:'11.11 Mega Sale',   mechanicNote:'The year’s largest marketplace event — full voucher stack, heaviest in-platform weighting.', discountPct:25 },
  { k:'12.12',   name:'12.12',             mechanicNote:'Festive close-out — pair with clearance and gift-set framing.', discountPct:20 },
  { k:'cnyraya', name:'CNY / Raya',        mechanicNote:'Cultural gifting moment — bundle and gift-set framing over discount depth.', discountPct:15 }
];

/* ── SKUs. cogs is admin-only; floor derives from it. ── */
const SKUS = [
  { id:'vitc',  name:'Vitamin C Ampoule 15.5%', spec:'Fresh Ceramided™ · 18ml',
    tier:'Core', msrp:56, sale:35, cogs:9,  shipping:0, handling:0, units:500, handle:'vitamin-c-ampoule-15-5-brightening-serum', url:'', urlOk:null,
    role:'Hero', roleNote:'Anchors every Spark Ad and the Hero Repair Duo.' },
  { id:'water', name:'Water Cream 80ml', spec:'Fresh Ceramided™',
    tier:'Core', msrp:51, sale:29, cogs:8,  shipping:0, handling:0, units:500, handle:'fresh-ceramided-water-cream-80ml', url:'', urlOk:null,
    role:'Anchor', roleNote:'Bundle partner for the hero. High repeat rate.' },
  { id:'sun',   name:'Aqua C Sun Serum SPF50+', spec:'50ml',
    tier:'Core', msrp:28, sale:19, cogs:5,  shipping:0, handling:0, units:500, handle:'aqua-c-dual-sun-serum-spf50-pa4', url:'', urlOk:null,
    role:'Trial', roleNote:'Lowest barrier. Daily-use habit builds repurchase.' },
  { id:'toner', name:'Essential Toner 200ml', spec:'Fresh Ceramided™',
    tier:'Entry', msrp:45, sale:25, cogs:6, shipping:0, handling:0, units:500, handle:'fresh-ceramided-essential-toner-200ml', url:'', urlOk:null,
    role:'Cold entry', roleNote:'Editor\u2019s Pick trust signal for first purchase.' },
  { id:'calm',  name:'Trouble Calming Ampoule', spec:'ACZERO™ · 30ml',
    tier:'Core', msrp:64, sale:39, cogs:10, shipping:0, handling:0, units:500, handle:'calming-ampoule-acne-prone-skin-30ml', url:'', urlOk:null,
    role:'Premium', roleNote:'Highest ASP. Acne and sensitive niche from M3.' },
  { id:'eye',   name:'Eye Cream 35ml', spec:'Fresh Ceramided™',
    tier:'Core', msrp:56, sale:29, cogs:8,  shipping:0, handling:0, units:500, handle:'fresh-ceramided-eye-cream-35ml', url:'', urlOk:null,
    role:'Upsell', roleNote:'Email add-on to past buyers. Never a cold-traffic lead.' }
];

/* ── Per-platform fee rates for the floor engine. Shopify is the lead
   price (0% — own store), so it's also the default floor reference.
   Lazada starts at 0 until the real commission is confirmed — nothing
   guessed, same rule as everywhere else in this file. ── */
const PLATFORM_FEES = { shopify:0, shopee:0.16, tiktok:0.02, lazada:0 };

const BUNDLES = [
  { id:'starter', name:'Barrier Starter Duo', tier:'Entry',
    parts:['toner','sun'], price:38, handle:'', url:'', urlOk:null,
    stage:'Cold paid traffic', note:'First purchase for audiences who do not know the brand.' },
  { id:'hero', name:'Hero Repair Duo', tier:'Core',
    parts:['vitc','water'], price:53, handle:'', url:'', urlOk:null,
    stage:'Warm retargeting', note:'Best margin. The landing page for all TikTok video ads.' },
  { id:'ritual', name:'Full Ritual Set', tier:'Premium',
    parts:['toner','vitc','water','eye','sun'], price:97, handle:'', url:'', urlOk:null,
    stage:'Email to past buyers', note:'Never run cold paid to this. Requires existing trust.' },
  { id:'recovery', name:'Clinical Recovery Set', tier:'Premium',
    parts:['calm','water','sun'], price:79, handle:'', url:'', urlOk:null,
    stage:'Concern-led retargeting', note:'For the acne and sensitivity audience segment.' }
];

/* ── Key sell focus — reframes each SKU's existing `role` (SKUS above,
   set at launch) into the 4 buckets a marketer actually plans against.
   Doesn't change any role, just groups them and states why in one line;
   the "why" text still comes from each SKU's own roleNote. ── */
const SELL_FOCUS_MAP = {
  'Hero':       { bucket:'Hero — primary conversion', bucketWhy:'The lead story every ad and bundle points back to.' },
  'Premium':    { bucket:'Hero — primary conversion', bucketWhy:'Highest-ASP hero for a specific concern niche, not the cold-traffic lead.' },
  'Anchor':     { bucket:'AOV / bundle driver', bucketWhy:'Shows up across the most bundles — lifts average order value rather than leading on its own.' },
  'Trial':      { bucket:'Value / entry', bucketWhy:'Lowest price barrier — earns the daily-use habit that drives repurchase.' },
  'Cold entry': { bucket:'Value / entry', bucketWhy:'Trust signal for a first-time buyer who doesn’t know the brand yet.' },
  'Upsell':     { bucket:'Upsell — existing buyers only', bucketWhy:'Never shown to cold traffic — an email add-on after trust is already established.' }
};

/* ── Live shopfront pricing — the 4 storefronts linked from linktr.ee/d.nuvo
   and given directly by the team. TikTok Shop has no confirmed storefront
   link yet (Linktree only lists the TikTok social profile, not a shop) —
   stays blank rather than guessed, same rule as Shop links above. */
const SHOPFRONT_PLATFORMS = [
  { k:'shopify', name:'Shopify (DTC)' },
  { k:'shopee',  name:'Shopee' },
  { k:'lazada',  name:'Lazada' },
  { k:'tiktok',  name:'TikTok Shop' }
];
const SHOPFRONT_LINK_DEFAULTS = {
  shopee: 'https://shopee.sg/d.nuvo',
  lazada: 'https://www.lazada.sg/dnuvo',
  tiktok: 'https://www.tiktok.com/@d.nuvo_official'
};

/* ── Masstige tiering ── */
const TIERS = [
  { k:'t1', name:'Entry — acquisition', range:'S$19 – S$38',
    role:'Get the first purchase',
    body:'Trial sizes, discovery kits and the Starter Duo. Priced to remove hesitation about an unknown brand, never to signal a cheap product.' },
  { k:'t2', name:'Core — hero SKUs', range:'S$29 – S$53',
    role:'Carry the margin',
    body:'Vitamin C Ampoule, Water Cream, Sun Serum and the Hero Duo. This is where the clinical story lives and where discount discipline matters most.' },
  { k:'t3', name:'Premium — ritual sets', range:'S$79 – S$135',
    role:'Lift order value',
    body:'Full Ritual and Clinical Recovery sets. Sold to people who already trust the brand — email, retargeting and live shopping only.' }
];

/* ── Platform pricing behaviour ── */
const CHAN_LOGIC = [
  { name:'Shopify', pill:'p-v', goal:'Protect price · build order value',
    lines:[
      'Full MSRP. This is the reference price every other channel respects.',
      'Buy 2 or more items, 10% off. Free shipping above S$60.',
      'Member-only ritual sets that appear nowhere else.',
      'Subscribe and save 15% on the hero SKU.',
      'Never run a sitewide percentage sale — it resets the price anchor.'
    ]},
  { name:'Shopee', pill:'p-g', goal:'Win the conversion',
    lines:[
      'Match Shopify MSRP on the listing. Discount only through vouchers.',
      'Always-on seller voucher: S$5 off S$40 or more.',
      'Stack platform vouchers and coins on 9.9, 11.11 and 12.12.',
      'Add-on deals attach the Sun Serum to any cart above S$40.',
      'Effective discount ceiling 15–25% on mega days, voucher-led only.'
    ]},
  { name:'TikTok Shop', pill:'p-a', goal:'Convert the impulse',
    lines:[
      'Live-only bundle pricing, two-hour window, announced 48h ahead.',
      'Flash deals on the hero Vitamin C Ampoule during live sessions.',
      'Creator affiliate commission 12%, tracked per unique code.',
      'Product page price matches Shopify. The deal lives in the live room.',
      'Never leave a flash price live after the session ends.'
    ]}
];

/* ── The five gates. Signature element. ── */
const GATES = [
  { id:'reviews', label:'Reviews',  target:50,  unit:'on hero SKU',
    unlocks:'Paid advertising',
    why:'96% of buyers here check reviews before trying an unknown brand. Ads pointed at a review-less page return about 1.0×.' },
  { id:'rating',  label:'Rating',   target:4.7, unit:'★ shop rating',
    unlocks:'Shopee flash deals',
    why:'Platform requirement. Flash deal applications are rejected below 4.7★ with under 3% organic conversion.' },
  { id:'roas',    label:'ROAS',     target:1.5, unit:'× blended',
    unlocks:'Budget scale-up',
    why:'Do not add budget to a channel that has not proven it can return above the floor for two consecutive weeks.' },
  { id:'pool',    label:'Audience', target:1000,unit:'people retargetable',
    unlocks:'Meta retargeting',
    why:'Cold Meta beauty returns about 1.57× here — below the acquisition floor. Warm returns 3.5×. Wait for the pool.' },
  { id:'buyers',  label:'Buyers',   target:200, unit:'past purchasers',
    unlocks:'Premium ritual sets',
    why:'A S$97 set converts to people who already trust the brand. Selling it earlier wastes the impression.' }
];

/* Target ROAS ramp for the Media plan's per-month view — derived from the
   already-authored plan copy in METRICS ("1.5× by M3, 2.0× by M5"), not a
   new number. M1-M3 hold the floor, M4 interpolates, M5-M6 hold the goal. */
function targetRoasFor(monthIndex){
  const ramp = [1.5, 1.5, 1.5, 1.75, 2.0, 2.0];
  return ramp[monthIndex] != null ? ramp[monthIndex] : ramp[ramp.length-1];
}

/* ── Phases ── */
const PHASES = [
  { n:1, name:'Build trust', months:'M1–M2', tag:'p-g',
    focus:'Reviews and proof',
    doing:'Gift 20+ nano creators. Collect 50 reviews across Shopee and TikTok Shop. Post three times a week. Always-on voucher live. No paid ads at all.',
    roas:'Organic only',
    gate:'50 reviews on the hero SKU and a 4.7★ shop rating' },
  { n:2, name:'Activate paid', months:'M3–M4', tag:'p-v',
    focus:'Two channels, proven',
    doing:'TikTok video ads and Shopee search ads go live. Google Shopping added in M3. First mega sale. Two to three paid micro-creator posts a month.',
    roas:'1.5 – 2.0× blended',
    gate:'Blended 1.5× sustained across two weeks' },
  { n:3, name:'Scale and events', months:'M5–M6', tag:'p-a',
    focus:'Volume and sell-through',
    doing:'Meta retargeting opens. Market pop-up. 11.11 at maximum budget. Beauty fair in December. Clear remaining stock.',
    roas:'2.0×+ blended',
    gate:'All units sold by 31 December' }
];

const RULES = [
  { t:'Reviews before ads', b:'No paid spend until the review gate clears. This single rule decides whether the budget works or is wasted.' },
  { t:'Traffic lands on bundles', b:'Cost per acquisition here is about S$18.82. A S$19–29 single product cannot absorb that. A S$38–53 bundle can.' },
  { t:'Two channels, then more', b:'Splitting S$2,500 across five platforms gives none of them enough to exit learning. Concentrate, then widen.' },
  { t:'Never below the floor', b:'Floor equals cost plus shipping plus handling plus platform fee, sized to leave 3x cost as profit. Shopify is the lead price every other channel is checked against. Every promo is checked before it goes live.' }
];

/* ── MY/TH expansion research — findings from real market/regulatory
   research (sourced, not assumed), not a decided plan. Distributor
   candidates start empty in state; nothing here invents a real company
   or contact. ── */
const EXPANSION_MARKETS = [
  { k:'malaysia', name:'Malaysia',
    stat:'~6.5% CAGR growth. High-end cosmetic imports exceeded USD 343M in 2024 — positioned as a premium-import hub, not a discount market.',
    fit:'Premium/import-hub positioning matches d.nuvo\'s pricing tier directly — no discounting needed to enter.',
    source:'ASEAN Cosmeceuticals Market Size — Fortune Business Insights' },
  { k:'thailand', name:'Thailand',
    stat:'Skincare specifically growing ~9%/year over the past 5 years, now valued at ~109.91B baht. Market is shifting toward "science-based, skin-health-focused" products.',
    fit:'That positioning shift is a direct match for d.nuvo\'s ceramide/barrier-repair claims — the story doesn\'t need to change for this market.',
    source:'T-Beauty\'s $9 Billion Test — Nation Thailand' }
];
const EXPANSION_CHECKLIST = {
  malaysia: [
    { k:'cnh', label:'CNH (Cosmetic Notification Holder) secured', why:'Legally required — d.nuvo isn\'t a Malaysian-registered company, so a local agent must hold this role before any product is notified.',
      url:'https://www.freyrsolutions.com/who-is-a-cnh-in-malaysia' },
    { k:'npra', label:'NPRA cosmetic notification submitted', why:'Required under CDCR 1984 before any sale, import, or possession in Malaysia. Selling unnotified stock risks seizure and platform bans. Submitted online through NPRA\'s QUEST 3+ portal.',
      url:'https://www.npra.gov.my/index.php/en/component/content/article/147-guidelines-central/guidelines-cosmetic/1595-2-0-cosmetic-notification' },
    { k:'halal', label:'Halal certification evaluated (optional)', why:'Not legally required for skincare, but worth a deliberate yes/no rather than a default — relevant to reach in this market.',
      url:'https://www.npra.gov.my/index.php/en/frequently-asked-questions-faqs.html' }
  ],
  thailand: [
    { k:'entity', label:'Local entity or agent secured', why:'Same structural requirement as Malaysia\'s CNH — a foreign brand needs a local party to notify through. Thai FDA\'s e-submission system does not accept applications directly from foreign companies.',
      url:'https://en.reach24h.com/service/cosmetic/thailand-cosmetics-notification' },
    { k:'fda', label:'Thai FDA cosmetic notification submitted', why:'Required under the ASEAN Cosmetic Directive before legal sale. Filed through the SKYNET e-submission system at least 15 days before import; certificate valid 3 years.',
      url:'https://thailand.freyrsolutions.com/cosmetic-product-notification-in-thailand' },
    { k:'labeling', label:'Thai-language labeling prepared', why:'Standard requirement for retail sale — confirm exact wording rules with the local agent once secured.',
      url:'https://www.artixio.com/post/thailand-cosmetics-regulations-registration-process' }
  ]
};

/* ── Research leads — real, sourced regulatory/CNH-agent firms that could
   act as local agent/Cosmetic Notification Holder in each market. This is
   the verifiable category of "distributor/CNH candidate": firms that
   publicly advertise this exact service. It is a starting shortlist to
   vet, not an engaged contact — kept separate from S.expansion.distributors
   (that table only ever holds contacts the team has actually verified). */
const EXPANSION_LEADS = {
  malaysia: [
    { name:'Freyr Solutions', role:'Regulatory consultant / can act as local CNH agent', url:'https://www.freyrsolutions.com/who-is-a-cnh-in-malaysia' },
    { name:'REACH24H', role:'Cosmetic notification and regulatory registration agent', url:'https://en.reach24h.com/service/cosmetic/malaysia-cosmetics-notification' },
    { name:'CIRS Group', role:'ASEAN cosmetics registration consultant, covers Malaysia', url:'https://www.cirs-group.com/en/cosmetics/asean-cosmetics-registration-thailand-vietnam-philippines-malaysia-singapore-indonesia' },
    { name:'Emerhub', role:'Market-entry and cosmetic product registration consultant', url:'https://emerhub.com/malaysia/cosmetics-registration-malaysia/' },
    { name:'Conzlab Berhad', role:'NPRA cosmetic notification service provider', url:'https://www.conzlab.com/shop/national-pharmaceutical-regulatory-agency-npra-cosmetic-notification-not-370' }
  ],
  thailand: [
    { name:'Freyr Solutions (Thailand)', role:'Regulatory consultant / can act as local agent for Thai FDA filing', url:'https://thailand.freyrsolutions.com/cosmetic-product-notification-in-thailand' },
    { name:'REACH24H', role:'Cosmetic notification and regulatory registration agent', url:'https://en.reach24h.com/service/cosmetic/thailand-cosmetics-notification' },
    { name:'Emerhub', role:'Market-entry consultant, foreign-investor cosmetic registration guide', url:'https://emerhub.com/thailand/cosmetic-product-registration-in-thailand/' },
    { name:'Lex Bangkok', role:'Legal/regulatory firm handling Thai FDA cosmetic registration for foreign brands', url:'https://lexbangkok.com/thai-fda-registration-korean-cosmetic-brand/' }
  ]
};

/* ── Recommended 2026 retail/cultural windows for MY/TH — checked against
   public holiday calendars, not invented. Hari Raya is moon-sighting
   dependent (Malaysia's government confirms it close to the date each
   year) — flagged rather than stated as fixed. ── */
const EXPANSION_EVENTS_2026 = {
  malaysia: [
    { name:'Chinese New Year', date:'17–18 Feb 2026 (public holiday; season runs into early March)',
      angle:'The single biggest MY gifting moment for the Chinese-Malaysian segment — CNY gift-set bundle, red/gold packaging framing.' },
    { name:'Hari Raya Aidilfitri', date:'Late Mar 2026 — exact date confirmed closer to the time by moon sighting',
      angle:'Major gifting and shopping season for the Malay-Muslim segment — bundle and gift framing over discount depth.' },
    { name:'Merdeka Day / Malaysia Day season', date:'31 Aug – 16 Sep 2026',
      angle:'Patriotic national-pride retail season ("Merdeka Sale") — a good window for a value-tier bundle push.' },
    { name:'Deepavali', date:'8–9 Nov 2026',
      angle:'Gifting moment for the Malaysian-Indian segment, overlapping with the 11.11 lead-in.' },
    { name:'11.11 / 12.12', date:'11 Nov / 12 Dec 2026',
      angle:'Largest marketplace mega-sale days — same mechanic as Singapore, heaviest Shopee/TikTok weighting.' }
  ],
  thailand: [
    { name:'Chinese New Year', date:'17–18 Feb 2026',
      angle:'Also widely celebrated by Thailand\'s Thai-Chinese population — same gift-set logic as Malaysia.' },
    { name:'Songkran (Thai New Year)', date:'13–15 Apr 2026',
      angle:'Thailand\'s hottest sun-exposure season and biggest domestic travel holiday — a genuine seasonal hook for Sun Serum plus after-sun barrier repair, not just a generic gifting tie-in.' },
    { name:'Loy Krathong', date:'7 Nov 2026',
      angle:'Culturally significant gifting/beauty moment ahead of year-end — smaller than Songkran, still worth a light bundle push.' },
    { name:'11.11 / 12.12', date:'11 Nov / 12 Dec 2026',
      angle:'Largest marketplace mega-sale days, same as Malaysia and Singapore.' }
  ]
};

/* ── Channel briefs ── */
const CHAN_BRIEFS = [
  { id:'tiktok', name:'TikTok Shop Ads', pill:'p-a', role:'Discovery', owner:'Ops builds · Admin approves',
    rows:[
      ['Opens','Month 2, and only once the review gate has cleared'],
      ['Formats','Video Shopping Ads on creator footage · Spark Ads boosting the best organic posts · Live Shopping Ads from M3'],
      ['Lands on','Hero Repair Duo — never a single product page'],
      ['Audience','Female 22–45 · K-beauty, ceramide and skincare interest · past purchasers excluded from prospecting'],
      ['Return target','1.8 – 4.0×'],
      ['Stop when','Return under 1.2× after seven days with two creatives tested. Swap the creative before adding budget.'],
      ['Refresh','Every 14 days regardless of performance. Stale creative is the most common cause of decay.']
    ]},
  { id:'shopee', name:'Shopee Search & Discovery', pill:'p-g', role:'Conversion', owner:'Ops builds · Admin approves',
    rows:[
      ['Opens','Month 2'],
      ['Keywords','vitamin c serum singapore · ceramide serum sg · korean skincare serum · spf serum sg · acne serum singapore'],
      ['Lands on','Barrier Starter Duo listing'],
      ['Return target','2.0× at open, 4.0× from Month 3'],
      ['Flash deals','Requires the rating gate. Apply for 9.9 by early August and 11.11 by early October — nominations close four to six weeks out.'],
      ['Vouchers','Always-on S$5 off S$40. Stack seller and platform vouchers on mega days only.']
    ]},
  { id:'google', name:'Google Shopping / Performance Max', pill:'p-v', role:'Capture', owner:'Agency builds',
    rows:[
      ['Opens','Month 3'],
      ['Campaigns','Branded shopping on the brand name · category shopping on ceramide and vitamin C terms · Performance Max once 50 conversions are tracked'],
      ['Return target','4.0 – 8.0× — typically the strongest paid channel at scale'],
      ['Creative','Strongest review quote plus a before and after image. Price and free-shipping threshold in the headline.']
    ]},
  { id:'meta', name:'Meta — retargeting only', pill:'p-r', role:'Warm only', owner:'Agency builds',
    rows:[
      ['Opens','Month 4, and only once the audience gate has cleared'],
      ['Audiences','Site visitors 30 days · TikTok video engagers · past purchasers · 1% lookalike from M5 once the buyer base passes 200'],
      ['Return target','3.0 – 4.0× warm'],
      ['Never','Cold prospecting. It returns about 1.57× here — below the acquisition floor for a brand with no review history.'],
      ['Creative','Review carousel and creator before-and-after footage. Studio-polished assets underperform.']
    ]}
];

/* ── Monthly plan ── */
/* Re-anchored to a 15 Aug 2026 start (was Jul), against the real SG retail
   calendar (9.9/10.10/11.11/12.12 dates + CNY 2027 confirmed 6-8 Feb) —
   not assumed placeholder dates. 11.11 sits inside M3's window, which is
   why the Mega KOL push and the unit peak both land there, not M5 as in
   the old Jul-start table. Units ramp 300→750→taper to 400, summing to
   the same 3,000-unit goal, shaped around the $10K flat M1-M3 budget
   (see computeBudget) tapering once M4-M6 budget becomes revenue-funded. */
const MONTHS = [
  { k:'M1', label:'M1 · 15 Aug–14 Sep', units:300, price:24,
    split:{ tiktok:0,    shopee:0,    google:0,    meta:0,    kol:1.00 },
    media:'Setup — pixels, listings, bundles live before 9.9', kolWork:'Gift 20 nano creators, first UGC batch live',
    events:'Creator content day', promo:'9.9 Super Shopping Day (Sep 9) — first mega-sale push' },
  { k:'M2', label:'M2 · 15 Sep–14 Oct', units:450, price:24,
    split:{ tiktok:0.26, shopee:0.26, google:0,    meta:0,    kol:0.48 },
    media:'TikTok and Shopee ads open', kolWork:'One paid micro post, first livestream test',
    events:'Apply for 11.11 marketplace slot', promo:'10.10 Brand Day — bundle push' },
  { k:'M3', label:'M3 · 15 Oct–14 Nov', units:750, price:24,
    split:{ tiktok:0.31, shopee:0.27, google:0.15, meta:0,    kol:0.27 },
    media:'Full budget on proven channels ahead of 11.11', kolWork:'3 Mega KOL livestreams ($900 each) targeting 11.11',
    events:'Market pop-up with live co-host', promo:'11.11 Singles Day — deepest single-day discount of the year' },
  { k:'M4', label:'M4 · 15 Nov–14 Dec', units:600, price:24,
    split:{ tiktok:0.31, shopee:0.25, google:0.17, meta:0.06, kol:0.21 },
    media:'Scale 11.11 winners, cut underperformers', kolWork:'One macro post, retarget 11.11 buyers',
    events:'Pharmacy sampling begins', promo:'12.12 Year-End Sale' },
  { k:'M5', label:'M5 · 15 Dec–14 Jan', units:500, price:24,
    split:{ tiktok:0.30, shopee:0.25, google:0.15, meta:0.14, kol:0.16 },
    media:'Clearance push, replenishment email to existing buyers', kolWork:'One micro post',
    events:'Beauty fair booth', promo:'New Year clearance, repeat-buyer focus' },
  { k:'M6', label:'M6 · 15 Jan–14 Feb', units:400, price:24,
    split:{ tiktok:0.29, shopee:0.26, google:0.14, meta:0.17, kol:0.14 },
    media:'CNY gifting push — leaner budget, lean on repeat/organic', kolWork:'CNY gift-set content with proven top creators',
    events:'CNY gifting campaign', promo:'CNY 2027 (6–8 Feb, confirmed) — gift-set bundles' }
];

/* ── Per-SKU allocation weights within each channel ──
   Named products, not broad channel totals.            */
const ALLOC = {
  tiktok: [
    { target:'hero',    label:'Hero Repair Duo',      w:0.45, fmt:'Video Shopping Ads on creator footage', kpi:'2.0× return' },
    { target:'vitc',    label:'Vitamin C Ampoule',    w:0.30, fmt:'Spark Ads on the best organic post',    kpi:'1.5% click rate' },
    { target:'starter', label:'Barrier Starter Duo',  w:0.15, fmt:'Cold prospecting video',                kpi:'S$19 cost per order' },
    { target:'calm',    label:'Trouble Calming',      w:0.10, fmt:'Live flash deal',                       kpi:'Live sell-through' }
  ],
  shopee: [
    { target:'starter', label:'Barrier Starter Duo',  w:0.40, fmt:'Search ads on category keywords',  kpi:'4.0× return' },
    { target:'vitc',    label:'Vitamin C Ampoule',    w:0.30, fmt:'Search ads on branded and hero terms', kpi:'3.0× return' },
    { target:'hero',    label:'Hero Repair Duo',      w:0.20, fmt:'Discovery ads on similar products', kpi:'AOV above S$45' },
    { target:'sun',     label:'Aqua C Sun Serum',     w:0.10, fmt:'Add-on deal attachment',            kpi:'Attach rate 15%' }
  ],
  google: [
    { target:'brand',   label:'Brand terms',          w:0.35, fmt:'Branded shopping',       kpi:'8.0× return' },
    { target:'vitc',    label:'Vitamin C Ampoule',    w:0.30, fmt:'Category shopping',      kpi:'4.0× return' },
    { target:'hero',    label:'Hero Repair Duo',      w:0.20, fmt:'Shopping feed',          kpi:'4.0× return' },
    { target:'calm',    label:'Trouble Calming',      w:0.15, fmt:'Concern keyword capture',kpi:'Acne search terms' }
  ],
  meta: [
    { target:'hero',    label:'Hero Repair Duo',      w:0.45, fmt:'Review carousel to site visitors', kpi:'3.5× return' },
    { target:'ritual',  label:'Full Ritual Set',      w:0.30, fmt:'Past-buyer upsell',                kpi:'AOV above S$90' },
    { target:'eye',     label:'Eye Cream',            w:0.25, fmt:'Add-on retargeting',               kpi:'Attach to repeat orders' }
  ],
  kol: [
    { target:'gift',    label:'Nano gifting stock',   w:0.45, fmt:'Product cost, 10–15 creators monthly', kpi:'12 posts landed' },
    { target:'micro',   label:'Micro paid posts',     w:0.35, fmt:'S$300–800 per post plus Spark rights', kpi:'Attributed sales' },
    { target:'macro',   label:'Macro quarterly',      w:0.20, fmt:'S$1,500–3,000 per post',              kpi:'Reach and credibility' }
  ]
};

const CHAN_META = {
  tiktok:{ name:'TikTok Shop', color:'#4B3FA8' },
  shopee:{ name:'Shopee',      color:'#2F6B4F' },
  google:{ name:'Google',      color:'#B8781F' },
  meta:  { name:'Meta',        color:'#A8323C' },
  kol:   { name:'KOL',         color:'#8B82D4' }
};

/* ── Role quickstart cards (overview panel) ── */
const ROLE_QUICKSTART = [
  {
    role:'Media planner',
    jump:'media',
    focus:'Budget engine and allocation by SKU',
    guide:[
      'Check launch gates before scaling spend',
      'Assign each dollar to a SKU or bundle',
      'Close month with actuals in Reporting'
    ]
  },
  {
    role:'Social / KOL manager',
    jump:'kol',
    focus:'Creator pipeline and verified proof capture',
    guide:[
      'Run source > contact > ship > post > complete',
      'Leave unverified numbers blank',
      'Route exceptions to approvals'
    ]
  },
  {
    role:'Event and retail lead',
    jump:'events',
    focus:'Campaign calendar and retail activations',
    guide:[
      'Align event windows with creator drops',
      'Avoid major pushes before trust gates open',
      'Log impact in monthly reporting'
    ]
  },
  {
    role:'Content creative manager',
    jump:'content',
    focus:'Message system and channel adaptation',
    guide:[
      'Map each content batch to one KPI',
      'Maintain claim-safe copy hierarchy',
      'Refresh hooks by phase, not by noise'
    ]
  }
];

/* ── Competitor pulse (import-ready rows) ──
   Keep this list to six closest competitors for d.nuvo's
   ceramide and barrier-repair positioning.            */
const COMPETITOR_INTEL = [
  {
    competitor:'CeraVe',
    product:'Moisturizing Cream',
    productType:'Ceramide moisturizer / barrier repair',
    channel:'Brand PDP',
    currency:'USD',
    listPrice:'14.99',
    promoPrice:'',
    observedAt:'2026-08-05',
    keyMessage:'Three essential ceramides, barrier restore, MVE delivery technology.',
    source:'https://www.cerave.com/skincare/moisturizers/moisturizing-cream'
  },
  {
    competitor:'Cetaphil',
    product:'Moisturizing Lotion',
    productType:'Sensitive skin barrier hydration',
    channel:'Brand PDP',
    currency:'USD',
    listPrice:'',
    promoPrice:'',
    observedAt:'2026-08-05',
    keyMessage:'48-hour hydration and moisture barrier restoration in one week.',
    source:'https://www.cetaphil.com/us/products/product-categories/body-moisturizers/moisturizing-lotion/302990241334.html'
  },
  {
    competitor:'COSRX',
    product:'Balancium Comfort Ceramide Cream 80g',
    productType:'Ceramide comfort cream',
    channel:'Watsons SG',
    currency:'SGD',
    listPrice:'35.20',
    promoPrice:'31.68',
    observedAt:'2026-08-05',
    keyMessage:'Comfort-led barrier support for sensitive skin.',
    source:'https://www.watsons.com.sg/cosrx-balancium-comfort-ceramide-cream-80g/p/BP_28875'
  },
  {
    competitor:'CERADAN',
    product:'Ceramide Daily Moisturising Cream 500g',
    productType:'Daily ceramide moisturizer',
    channel:'Watsons SG',
    currency:'SGD',
    listPrice:'45.90',
    promoPrice:'36.70',
    observedAt:'2026-08-05',
    keyMessage:'Clinical ceramide care for daily barrier support.',
    source:'https://www.watsons.com.sg/ceradan-ceramide-daily-moisturising-cream-500g/p/BP_85774'
  },
  {
    competitor:'ILLIYOON',
    product:'Ceramide Ato Gentle Skin Toner 250ml',
    productType:'Ceramide daily barrier line',
    channel:'Watsons SG',
    currency:'SGD',
    listPrice:'25.00',
    promoPrice:'20.00',
    observedAt:'2026-08-05',
    keyMessage:'Gentle daily ceramide maintenance with K-beauty positioning.',
    source:'https://www.watsons.com.sg/illiyoon-ceramide-ato-gentle-skin-toner-250ml/p/BP_92916'
  },
  {
    competitor:'Suu Balm',
    product:'Ceramide Moisturiser (Rapid Itch Relief) 75ml',
    productType:'Ceramide + itch relief moisturizer',
    channel:'Watsons SG',
    currency:'SGD',
    listPrice:'24.40',
    promoPrice:'20.74',
    observedAt:'2026-08-05',
    keyMessage:'Rapid itch-relief framing plus ceramide care.',
    source:'https://www.watsons.com.sg/suu-balm-ceramide-moisturiser-rapid-itch-relief-75ml/p/BP_26677'
  }
];

/* ── d.nuvo message stack for KOL and content teams ── */
const DNUVO_MESSAGE_STACK = [
  { lane:'Emotional', text:'Your skin deserves ingredients that go deeper.' },
  { lane:'Educational', text:'Stop moisturizing the surface. Start feeding the layers.' },
  { lane:'Credibility', text:'15x deeper (or validated benchmark), not a claim - a patented system.' },
  { lane:'Differentiation', text:'A ceramide delivery system designed for absorption plus repair.' }
];

/* ── Channel long-tail map for a coordinated 6-month push ── */
const LONG_TAIL_PLAN = [
  {
    channel:'Shopee',
    role:'Conversion and repeat purchase',
    m12:'Reviews, voucher mechanics, and PDP trust depth',
    m34:'Bundle scaling and retargeting once trust gates clear',
    m56:'Repeat-buyer packs and campaign-event conversion spikes'
  },
  {
    channel:'TikTok Shop',
    role:'Discovery and creator proof loop',
    m12:'Education-first UGC and mechanism explainers',
    m34:'Live selling tied to winning claim hooks',
    m56:'Creator clusters by segment and replay conversion'
  },
  {
    channel:'Shopify',
    role:'Brand authority and lifecycle capture',
    m12:'Science story pages and trust proof blocks',
    m34:'Bundle landing pages with remarketing flows',
    m56:'Loyalty and routine upsell to lift LTV'
  },
  {
    channel:'Lazada',
    role:'Incremental marketplace reach',
    m12:'SKU hygiene and listing consistency',
    m34:'Campaign calendar integration with retail moments',
    m56:'Value-set offers while holding MSRP architecture'
  }
];

/* ── Buyer personas for Singapore and SEA markets ── */
const BUYER_PERSONAS = [
  {
    id:'sensitive-pro',
    name:'Sensitive Skin Young Professional',
    age:'24-34',
    market:'Singapore + Tier 1 SEA cities',
    pain:'Recurring redness, irritation, and fear of trying active ingredients.',
    emotional:'Needs safety and visible calming without trial-and-error stress.',
    psychology:'Buys when dermatologist-style proof and real-skin reviews reduce risk.',
    entry:'Water Cream 80ml + Sun Serum SPF50+',
    sequence:'Education short video -> ingredient explainer -> first-order welcome offer -> 14-day check-in content -> bundle upsell',
    channels:['TikTok Shop','Shopee','Shopify']
  },
  {
    id:'acne-recovery',
    name:'Post-Acne Recovery Seeker',
    age:'20-30',
    market:'Singapore, Malaysia, Thailand, Philippines',
    pain:'Persistent marks, sensitivity after acne routines, barrier instability.',
    emotional:'Wants confidence return and fewer flare-up cycles.',
    psychology:'Responds to before/after proof and concern-specific routines over beauty claims.',
    entry:'Trouble Calming Ampoule + Water Cream',
    sequence:'Concern hook -> creator testimonial -> recovery protocol bundle -> review capture -> repeat regimen reminder',
    channels:['TikTok Shop','Shopee']
  },
  {
    id:'busy-mom',
    name:'Busy Family Caregiver',
    age:'30-45',
    market:'Singapore + urban SEA households',
    pain:'Time-poor routine, multiple skin needs in one household.',
    emotional:'Needs dependable products that simplify daily care.',
    psychology:'Prefers value bundles, clear usage steps, and low-risk first purchase.',
    entry:'Essential Toner + Sun Serum starter bundle',
    sequence:'Family-safe claim -> practical routine card -> bundle offer -> follow-up reorder prompt -> larger household pack',
    channels:['Shopee','Lazada','Retail']
  },
  {
    id:'trend-creator-fan',
    name:'Trend-Led Social Shopper',
    age:'18-28',
    market:'SEA social commerce audiences',
    pain:'Skincare trend fatigue and difficulty separating hype from real efficacy.',
    emotional:'Wants to feel early, informed, and socially validated.',
    psychology:'Converts through creator-led demos, live drops, and scarcity windows.',
    entry:'Vitamin C Ampoule hero SKU',
    sequence:'Creator demo -> live flash slot -> code-driven checkout -> UGC repost loop -> spark ad retargeting',
    channels:['TikTok Shop','Instagram Reels']
  },
  {
    id:'premium-routine',
    name:'Premium Routine Builder',
    age:'28-42',
    market:'Singapore + mature SEA beauty segments',
    pain:'Inconsistent results from fragmented products.',
    emotional:'Wants a complete routine with clinical authority and visible payoff.',
    psychology:'Buys complete systems when value and efficacy ladder are clearly framed.',
    entry:'Hero Repair Duo then Full Ritual Set',
    sequence:'Science-led landing page -> diagnostic quiz -> duo conversion -> proof email flow -> premium set upsell',
    channels:['Shopify','Shopee','Retail/Events']
  }
];

/* ── Pre-determined brand-ambassador personas for the Content module.
   Locked profiles so image/video prompts stay a consistent recurring
   character rather than a new face every generation. ── */
const BRAND_PERSONAS = [
  {
    id:'aera',
    name:'Aera (아라)',
    archetype:'The Athletic Armor',
    age:23,
    hometown:'Busan, South Korea',
    discipline:'Urban track & field / marathoner',
    aesthetic:'Earthy, raw, utilitarian, sharp',
    look:'Teal-green tracksuit with white panels, white sneakers, long golden-brown wavy hair. Never posed — always captured in motion.',
    backstory:'Grew up on Busan’s windy coast and spends about 70% of her day outdoors. A skincare skeptic for years — washed her face with whatever soap was in the gym locker room — until barrier damage and breakouts started affecting her confidence on the starting line. She did not want a 12-step routine; she wanted efficiency, protection and recovery.',
    skinCondition:'Windburn and chapping from exposure, sweat-clogged pores, jawline breakouts from sweatband friction and overtraining stress, dehydration and dark circles after long-haul travel to races.',
    tone:'Honest, motivational, slightly dry. Unfiltered — no posing, no polish.',
    platforms:'TikTok (raw workout content), Instagram (training diary)',
    palette:[{name:'Teal Green',hex:'#008080'},{name:'Olive Green',hex:'#4A5D23'},{name:'Concrete Grey',hex:'#808080'}],
    hashtags:['#AeraGlows','#SkinArmor','#FreshCeramide'],
    tagline:'Sweat is just weakness leaving the body, but it shouldn’t wreck your skin barrier.',
    contentFocus:['Brand trust and proof','Emotional'],
    eeatPillar:'Experience',
    marketProfile:{
      lifestyle:'Outdoors most of the day, trains twice daily, travels for races. Time-poor — anything that takes over 5 minutes morning or night gets skipped.',
      skincareRegime:'Minimal: cleanser, one multi-purpose barrier product, SPF. Abandons anything with a visible-results wait longer than 2-3 weeks.',
      priceSensitivity:'Will pay a premium for a product she trusts, but needs proof fast — a slow-to-show hero product loses her before it converts her.',
      purchaseDrivers:'Peer/teammate recommendation, visible before/after on someone with a similar lifestyle, no-fuss routine.',
      channelHabits:'TikTok for raw discovery, rarely reads long PDP copy — decides off video proof.'
    }
  },
  {
    id:'kaia',
    name:'Kaia (카이아)',
    archetype:'The Camera-Ready Canvas',
    age:21,
    hometown:'Seoul, South Korea',
    discipline:'K-pop trainee / dance creator / actress',
    aesthetic:'Vibrant, trendy, aspirational, polished',
    look:'Pink color-block crop top, chunky sneakers, short dark bob.',
    backstory:'Based in Seoul’s entertainment district — her days are a blur of dance rehearsals, vocal coaching, auditions and late-night editing under harsh ring lights. Unlike Aera, she has always cared about skincare, but struggles to heal it from heavy stage makeup, dance-floor sweat and lost sleep. Glass skin is a professional requirement for her, not vanity.',
    skinCondition:'Pores clogged by makeup and sweat, stress breakouts (an audition-day blemish is her defining crisis story), puffiness and dark circles from blue-light late-night edits, dehydration from harsh LED sets.',
    tone:'Bubbly, encouraging, deeply connected to her fanbase — shares the glamorous highs and the exhausting behind-the-scenes lows.',
    platforms:'TikTok (dance trends, GRWM audition vlogs), Instagram (curated aesthetic mood board)',
    palette:[{name:'Vibrant Pink',hex:'#FF66B2'},{name:'Studio Black',hex:'#1A1A1A'},{name:'Medium Purple',hex:'#9370DB'}],
    hashtags:['#KaiaShines','#GlassSkin'],
    tagline:'The best filter is a flawless skin barrier.',
    contentFocus:['Brand trust and proof','Educational'],
    eeatPillar:'Trustworthiness',
    marketProfile:{
      lifestyle:'Entertainment-industry schedule — rehearsals, auditions, late-night edits under harsh lighting. Image is professional stakes, not vanity.',
      skincareRegime:'Multi-step routine, chases whatever\'s trending, but repeat-buys only what visibly survives heavy makeup and stage lighting.',
      priceSensitivity:'Bundle and gift-set responsive — will try a new brand off a low-commitment sample size before a full-size buy.',
      purchaseDrivers:'Creator/influencer endorsement, aesthetic packaging, glass-skin proof under real lighting conditions.',
      channelHabits:'TikTok trends and Instagram mood boards; highly influenced by whoever she already follows.'
    }
  },
  {
    id:'mira',
    name:'Mira',
    archetype:'The Formulation Realist',
    age:29,
    hometown:'Singapore',
    discipline:'Former pharmaceutical QC analyst, now independent skincare reviewer',
    aesthetic:'Understated, credible, unpolished-but-articulate — not a white coat, not a set',
    look:'Neutral tones, no performative makeup. Reads ingredient labels on camera, films in ordinary rooms, never a studio backdrop.',
    backstory:'Spent years in pharmaceutical quality control before deciding consumers deserved someone honest translating INCI lists into plain language. She got tired of watching marketing outpace the data — so she started reviewing skincare the way she’d review a batch record.',
    skinCondition:'Mild adult acne and combination skin. She discusses her own patch-test failures on camera — her visibly imperfect skin is the credibility, not a liability.',
    tone:'Candid, evidence-first, calls out overclaiming — including d.nuvo’s own claims if unproven. That willingness to push back is what makes her trusted.',
    platforms:'YouTube and TikTok — long-form ingredient breakdowns and honest-review format',
    palette:[{name:'Off-White',hex:'#F5F5F5'},{name:'Amber Glass',hex:'#B8860B'}],
    hashtags:['#IngredientHonesty','#FormulationFacts'],
    tagline:'I’ve read the study. Let’s see if the marketing matches it.',
    contentFocus:['Educational','Brand trust and proof'],
    eeatPillar:'Expertise',
    marketProfile:{
      lifestyle:'Deliberate, research-first buyer. Reads INCI lists before checkout, cross-checks brand claims against published studies.',
      skincareRegime:'Targeted regime built around her own patch-test history — combination/mild-acne skin, cautious about actives that conflict.',
      priceSensitivity:'Will pay for verified formulation quality; actively distrusts price used as a quality signal on its own.',
      purchaseDrivers:'Ingredient transparency, third-party or published proof, a brand\'s willingness to admit what it can\'t yet prove.',
      channelHabits:'Long-form YouTube/TikTok reviews; the audience most likely to publicly call out an unproven claim.'
    }
  }
];

/* ── Starter questions for the Market personas interview tool — one set
   per persona (not generic/shared), each aimed at surfacing a content or
   marketing-positioning decision specifically, in that persona's own
   lifestyle/decision pattern. Examples to seed a real question, not
   exhaustive, and not a claim or finding that's actually been researched
   until an answer is logged. */
const PERSONA_QUESTION_STARTERS = {
  aera: [
    'Between "sweat-proof barrier protection" and "a ceramide delivery system built for absorption plus repair," which phrase actually makes you want to try this — and why does the other one fall flat for you?',
    'You see this brand on TikTok mid-scroll during a workout break — what stops your thumb in the first 3 seconds, versus what makes you keep scrolling?',
    'What would make you trust a claim about skin performing better under sweat and friction, without a lab report in front of you?',
    'Compared to how CeraVe or Cetaphil talk to someone like you, what is missing from d.nuvo\'s message right now?'
  ],
  kaia: [
    'What is the difference between a skincare ad that feels like "an ad" and one that feels like a real recommendation from someone you already follow?',
    'Would a gift-set or bundle framing get you to try d.nuvo faster than a single hero product — and what would the packaging or story need to look like?',
    'What proof — a before/after, a demo, an ingredient callout — would make you believe "glass skin under stage lighting" is real and not just filtered?',
    'What trend right now (a sound, a format, a challenge) would make d.nuvo\'s content feel current to you instead of dated?'
  ],
  mira: [
    'What specific piece of proof — a study, a before/after, an ingredient breakdown — would stop you from assuming a "ceramide delivery system" claim is marketing fluff?',
    'If d.nuvo cannot yet show a validated number for "deeper absorption," what non-numeric language would still earn your trust versus make you roll your eyes?',
    'What is a claim a competitor in this category makes that you would call out as overreach — and what should d.nuvo avoid to not repeat that mistake?',
    'Between a brand admitting a limitation and a brand overselling, which makes you more likely to actually buy — and why?'
  ]
};

/* ── Content formats the prompt builder can target ── */
const CONTENT_FORMATS = [
  { k:'ingredient-explainer', name:'Ingredient explainer (image carousel)', focus:'Educational' },
  { k:'mechanism-demo',       name:'Mechanism / absorption demo (short video)', focus:'Educational' },
  { k:'before-after',         name:'Before/after proof (image)', focus:'Brand trust and proof' },
  { k:'real-skin-review',     name:'Real-skin testimonial (video)', focus:'Brand trust and proof' },
  { k:'myth-bust',            name:'Myth-busting explainer (short video)', focus:'Educational' }
];

/* ── Independent module catalog (orchestrated from AI Strategy) ── */
const MODULE_CATALOG = [
  { id:'strategy',   name:'Strategy',          view:'strategy',   role:'All roles', defaultOn:true },
  { id:'brandpulse', name:'Brand pulse',       view:'brandpulse', role:'All roles', defaultOn:true },
  { id:'pricing',    name:'SKU pricing',       view:'pricing',    role:'Admin + planning', defaultOn:true },
  { id:'media',      name:'Media plan',        view:'media',      role:'Media planner', defaultOn:true },
  { id:'personas',   name:'Market personas',   view:'personas',   role:'Content + Media planner', defaultOn:true },
  { id:'kol',        name:'KOL hub',           view:'kol',        role:'Social / KOL manager', defaultOn:true },
  { id:'content',    name:'Content module',    view:'content',    role:'Content creative manager', defaultOn:true },
  { id:'events',     name:'Retail and events', view:'events',     role:'Event and retail lead', defaultOn:true },
  { id:'calendar',   name:'Calendar',          view:'calendar',   role:'All roles', defaultOn:true },
  { id:'report',     name:'Reporting',         view:'report',     role:'All roles', defaultOn:true },
  { id:'aistrategy', name:'AI strategy engine',view:'aistrategy', role:'Admin', defaultOn:true, adminOnly:true }
];

/* ── Site audit and strategy alignment defaults ── */
/* Starting point drawn from the Channel pricing logic playbook already
   authored elsewhere (CHAN_LOGIC) — verify against the real site and
   overwrite; score stays neutral (3) until someone actually checks. */
const SITE_AUDIT_TEMPLATE = {
  shopee: { score:3,
    issue:'Listing price not yet confirmed to match Shopify MSRP — needs a manual check.',
    recommendation:'Match Shopify MSRP on the listing. Run promos through the always-on S$5-off-S$40 voucher plus stacked mega-day vouchers (9.9/11.11/12.12), never a listing-price discount.' },
  tiktok: { score:3,
    issue:'No live-only bundle cadence confirmed running — hero SKU may be sitting at full price outside sessions.',
    recommendation:'Schedule flash deals on the Vitamin C Ampoule inside live sessions only (2-hour window, announced 48h ahead). Keep the standing product-page price matched to Shopify and pull the flash price the moment the session ends.' },
  shopify:{ score:3,
    issue:'Full MSRP enforcement not yet confirmed — check for any live sitewide discount running.',
    recommendation:'Hold full MSRP as the reference price every other channel respects. Use buy-2-save-10% and free-shipping-over-S$60 instead of a sitewide percentage sale, which resets the price anchor everywhere else.' }
};

const PROMO_ARCHITECTURE = [
  { k:'bau',    title:'BAU pricing',      value:'Full price', note:'No discount. Builds perceived value baseline.' },
  { k:'member', title:'Member welcome',   value:'15% off',    note:'First order only. Track conversion quality.' },
  { k:'flash',  title:'Flash / live',     value:'20% off',    note:'Limited slots or time windows only.' },
  { k:'floor',  title:'Never discount below', value:'25% off', note:'Maintains premium positioning and margin safety.' }
];

const RETAIL_EVENT_WINDOWS = [
  { month:'M1', phase:'Trust phase', focus:'Review seeding + first promotions', channel:'Shopee + IG', mechanic:'BAU full price + member welcome 15%', goal:'First reviews and store visibility' },
  { month:'M2', phase:'Proof phase', focus:'Bundle and creator checkpoints', channel:'Shopee + TikTok', mechanic:'Limited flash windows only', goal:'Lift social proof and CTR' },
  { month:'M3', phase:'Paid activation', focus:'9.9 readiness', channel:'Shopee + TikTok + Google', mechanic:'Event stack with strict floor checks', goal:'Stable ROAS above 1.5x' },
  { month:'M4', phase:'Scale phase', focus:'Retail and pharmacy support', channel:'Shopee + Retail', mechanic:'Channel-specific bundles', goal:'Retail trial + repeat signals' },
  { month:'M5', phase:'Peak prep', focus:'11.11 acceleration', channel:'Shopee + TikTok Live', mechanic:'Timed deal blocks', goal:'High-intent conversion' },
  { month:'M6', phase:'Year-end close', focus:'12.12 and festive sets', channel:'All channels', mechanic:'Seasonal bundles + gift framing', goal:'Stock clearance with margin discipline' }
];

/* ── KOL pipeline stages ── */
const KOL_STAGES = [
  { k:'sourced',  name:'Sourced',   desc:'Found and verified. Not yet contacted.' },
  { k:'contacted',name:'Contacted', desc:'Outreach sent. Waiting on a reply.' },
  { k:'shipped',  name:'Shipped',   desc:'Agreed and product sent.' },
  { k:'live',     name:'Posting',   desc:'Content running. Tracking the schedule.' },
  { k:'done',     name:'Complete',  desc:'All deliverables posted and reviewed.' }
];

/* ── CRM message templates ── */
const CRM_MSGS = [
  { k:'outreach', stage:'sourced', name:'1 · First approach — gifting',
    subj:'Gifting invitation',
    next:'Log the reply within 48 hours. No answer after five days? Send the nudge, once only.',
    body:`Hi {{name}},

We're {{brand}} — a Korean clinical skincare brand launching in {{market}}, built on a patented ceramide delivery system.

We've been reading through your {{platform}} posts and the way you talk about your skin honestly, including what hasn't worked, is exactly why we're reaching out rather than running an ad.

We'd like to send you our {{product}}. No payment, no script, no approval over what you write. We'd only ask for:

· Day 0 — first impression and the concern you're targeting
· Day 14 — an honest check-in, whatever's happening
· Day 30 — your verdict, with a before and after if you're happy to
· A review on the store once you've used it properly

You keep full ownership of everything you make. We'll also set up a discount code in your name for your followers — you earn nothing from it, they just get something useful.

If that sounds worth a try, reply and we'll ship within three days.

{{sender}}
{{brand}}` },

  { k:'nudge', stage:'sourced', name:'2 · Follow-up — no reply',
    subj:'Following up',
    next:'If this goes unanswered, mark the creator declined and move on. Do not send a third message.',
    body:`Hi {{name}},

Following up once on the gifting note I sent last week — no pressure at all if it isn't a fit or the timing is wrong.

If you'd like it, the offer stands: {{product}}, sent to you, yours to review honestly.

Either way, thanks for the content you put out. It's genuinely useful.

{{sender}}
{{brand}}` },

  { k:'confirm', stage:'contacted', name:'3 · Agreed — confirm and brief',
    subj:'Shipping details and brief',
    next:'Ship within three days. Add the tracking number and set the Day 0 date on the record.',
    body:`Hi {{name}},

Wonderful — thank you. Could you send me the name and address for delivery, and the best way to reach you as we go?

Here's the full brief so nothing is a surprise:

WHAT'S COMING
{{product}}, plus a card with a review link and your personal discount code.

WHAT WE'D LOVE
· Day 0 — first impression, and the concern you're hoping to address
· Day 14 — an honest check-in
· Day 30 — your verdict, before and after if you're comfortable
· A store review once you've used it properly

A FEW THINGS THAT MATTER TO US
· Say what you actually think. A mixed review is more useful to us than a glowing one.
· Please tag the post as gifted — it's required here, and it builds more trust than hiding it.
· Please don't claim it treats a medical condition. We can share exactly what our testing does and doesn't support if that's helpful.

YOUR CODE
{{code}} — 10% off for your followers. You earn nothing on it; it's there so your audience gets something.

Anything you'd like to ask before we send it?

{{sender}}
{{brand}}` },

  { k:'shipped', stage:'shipped', name:'4 · Shipped — on its way',
    subj:'On its way',
    next:'Check in on Day 3 that it arrived. Diarise the Day 0 post date.',
    body:`Hi {{name}},

Your {{product}} is on its way — tracking is {{tracking}}, and it should reach you within a few days.

When it lands, there's no rush on the first post. Use it for a few days first if you'd rather have something real to say.

The review link and your code ({{code}}) are on the card inside.

Let me know when it arrives.

{{sender}}
{{brand}}` },

  { k:'d14', stage:'live', name:'5 · Day 14 check-in',
    subj:'Two weeks in',
    next:'If results are weak, ask what is happening before requesting a post. An honest mixed review still earns trust.',
    body:`Hi {{name}},

Two weeks in — how is it going?

Genuinely asking, not chasing a post. If you're not seeing much yet, that's useful for us to know, and worth saying in your update. Ceramide work usually shows around the four-week mark, so a slow start is normal.

If you are ready to post the check-in, no particular format needed. Whatever fits how you normally share.

{{sender}}
{{brand}}` },

  { k:'d30', stage:'live', name:'6 · Day 30 — verdict and review',
    subj:'The 30-day verdict',
    next:'Request Spark rights on any post above 3% engagement. Log the review link on the record.',
    body:`Hi {{name}},

You're at the 30-day mark. Whenever you're ready for the final verdict post — and again, whatever you actually found is what we want.

Two small asks if you're willing:

· A review on the store, using the link on your card. Reviews are how a new brand earns the right to exist here, and yours carries weight.
· If your posts performed well, would you consider giving us paid usage rights? It means we can put budget behind your video as an ad. We'd pay separately for that and agree terms first — happy to talk through it.

Thank you for giving it a proper month.

{{sender}}
{{brand}}` },

  { k:'live', stage:'live', name:'7 · Live session — booking',
    subj:'Co-hosting a live session',
    next:'Confirm the date, then promote it 48 hours ahead. Prepare the live-only bundle price in advance.',
    body:`Hi {{name}},

Would you be up for co-hosting a live shopping session with us?

THE SHAPE OF IT
· Around 60 to 90 minutes on {{platform}}
· You demo the products you've actually been using and answer questions
· We run a live-only bundle price for the duration of the session
· Fee is {{fee}}, paid within seven days

WHAT WE HANDLE
Setup, the product stock, the offer, and promotion 48 hours ahead across our channels.

WHAT WE'D ASK
You promote it once to your audience beforehand, and turn up as yourself. No script — the sessions that work are the ones where the host says what they'd say anyway.

Do any of these dates work: {{dates}}?

{{sender}}
{{brand}}` },

  { k:'thanks', stage:'done', name:'8 · Wrap up and keep the door open',
    subj:'Thank you',
    next:'Add to the long-term roster. Re-approach at the next launch or restock.',
    body:`Hi {{name}},

That's the full run finished — thank you. Your posts brought us {{results}}, and more importantly they gave people something honest to read before buying.

Three things:

· We'd like to work with you again on the next launch, if you'd have us.
· Your code stays live, so your followers can keep using it.
· If you ever want restocks of anything you genuinely liked, just ask. No obligation attached.

Thank you for taking a chance on a brand nobody had heard of.

{{sender}}
{{brand}}` }
];

/* ── Events ── */
const EVENTS = [
  { name:'Creator content day', when:'M1 · Week 3', budget:'S$200–400', owner:'Brand + Creative',
    goal:'Produce launch content from 5–8 creators in one session',
    how:'A bright studio or cafe, three hours on a weekend. Full tester set out. Creators film first impressions on the spot. The footage becomes the first month of organic posts.' },
  { name:'Pharmacy sampling', when:'M4–M5', budget:'Product only', owner:'Brand',
    goal:'Mass trial with no media cost',
    how:'Approach the skincare category buyer four to six weeks out. Sachet plus a card carrying the review QR and a first-order code. Track redemptions through a unique code.' },
  { name:'Market pop-up', when:'M5 · 1–2 days', budget:'S$800–1,500', owner:'Brand + Ops',
    goal:'Direct sales and reviews collected in person',
    how:'Weekend market booth. Skin quiz on a tablet, product match, on-site code, review QR printed on every receipt. Capture email and messaging opt-ins at checkout.' },
  { name:'Beauty fair', when:'M6 · December', budget:'S$1,500–3,000', owner:'Brand',
    goal:'Clear remaining stock before year end',
    how:'Apply by September for a December booth. Fair-exclusive set pricing with a gift attached. A macro creator co-hosts and promotes ahead — their appearance is what drives the queue.' },
  { name:'Live shopping', when:'Monthly from M3', budget:'S$300–600 per session', owner:'Brand + creator',
    goal:'The highest-converting format available',
    how:'Creator co-hosts. Live-only bundle price, two-hour window. Promote 48 hours ahead. Time it with the pop-up in M5 so one audience feeds the other.' }
];

/* ── First eight weeks ── */
const WEEKS = [
  { n:'Week 1', t:'Platform setup', owner:'Ops', items:[
    'Confirm cost per unit for all six products and calculate every floor price',
    'Verify all six products are live on both marketplaces',
    'Create the two bundle listings that paid traffic will land on',
    'Turn on the always-on voucher',
    'Add the welcome code to the direct site',
    'Install tracking pixels and confirm they fire on purchase',
    'Set up business messaging with saved replies',
    'Check every product claim is defensible before any ad runs'
  ]},
  { n:'Week 2', t:'Creator outreach', owner:'Brand', items:[
    'Scout 25 nano creator candidates through hashtag search',
    'Verify follower count and engagement rate on each profile directly',
    'Message the top 20 with a personal note, not a template',
    'Set up a tracking code for each creator',
    'Confirm 10 to 12 and collect delivery addresses',
    'Book the creator content day for Week 3',
    'Begin posting three times a week'
  ]},
  { n:'Week 3–4', t:'Content and organic', owner:'Creative', items:[
    'Ship to every confirmed creator within three days',
    'Run the creator content day',
    'Repost every Day 0 post to the brand account',
    'Reply to every review within 24 hours',
    'Watch the shop rating climb toward the gate',
    'Day 14 creator check-ins go live',
    'Check the Month 1 unit target is within reach'
  ]},
  { n:'Week 5–8', t:'First paid ads', owner:'Ops', items:[
    'Gate check — confirm the review count before anything goes live',
    'Launch video shopping ads on the Hero Duo',
    'Use the strongest creator post as the first ad creative',
    'Read return at day seven — stop under 1.2×, add budget above 2×',
    'Launch marketplace search ads on the Starter Duo',
    'Apply for a flash deal slot once the rating gate clears',
    'Day 30 creator verdicts go live — repost all of them',
    'Plan the mega sale creative and voucher stack'
  ]}
];

/* ── Reporting metrics ── */
const METRICS = [
  { name:'Units per week', target:'50 rising to 200', src:'Seller centres and store orders',
    action:'More than 25% behind for two weeks — add a voucher, run a live session, ask a creator for an extra post. Check stock first.' },
  { name:'Blended return', target:'1.5× by M3, 2.0× by M5', src:'Revenue divided by total media spend',
    action:'Under 1.0× for two weeks — stop paid. Check ads land on bundles, creative is under 14 days old, and reviews are sufficient.' },
  { name:'Shop rating', target:'4.7★ or above', src:'Seller centre shop performance',
    action:'Below 4.7 — pause flash deal applications. Diagnose product, delivery or listing accuracy. Reply to every negative review within a day.' },
  { name:'Reviews', target:'50 by M2 · 150 by M6', src:'Review count on the hero product',
    action:'Behind — offer a next-order discount for photo reviews and chase every gifted creator who has not posted. Move budget from ads to gifting.' },
  { name:'Average order value', target:'At or above bundle price', src:'Store analytics',
    action:'Below S$30 — check no paid ad is pointing at a single product page. Fix the landing page before touching budget.' },
  { name:'Ad click rate', target:'Above 1.5%', src:'Ads manager, per campaign',
    action:'Below target — swap the creative. Test a different creator. Refresh every 14 days whatever the numbers say.' }
];


/* ── Fields a team member may propose changes to.
   Anything not listed here is admin-only and not
   editable from the team view at all.            ── */
const PROPOSABLE = {
  sku:    ['sale','handle','url'],
  bundle: ['price','handle','url'],
  month:  ['units','price','budgetOverride'],
  kol:    ['fee','rate']
};

const FIELD_LABELS = {
  sale:'Sale price', price:'Price', units:'Units target',
  handle:'Shop handle', url:'Shop URL', cogs:'Cost per unit',
  budgetOverride:'Monthly budget override'
};

/* ════════════════════════════════════════════════
   KOL SELECTION PLAYBOOK
   Source: Dnuvo KOL Selection Master Guide —
   GPM, Tick & Check fit factors, pricing scenarios.
   ════════════════════════════════════════════════ */

/* Two creator types, evaluated differently. */
const KOL_TYPES = {
  ugc: {
    k:'ugc', name:'UGC creator', short:'UGC',
    goal:'Produce reviews and reusable content',
    measure:'Review density and content quality',
    body:'Judged on whether they can make honest, watchable content and leave a real review. Followers matter less than authenticity — a 4,000-follower account with genuine skin footage outperforms a polished 80,000-follower one.',
    fields:['followers','er','posts','audience','contact','rate'],
    pill:'p-v'
  },
  live: {
    k:'live', name:'Livestream creator', short:'LIVE',
    goal:'Convert an audience in real time',
    measure:'GPM — gross merchandise value per thousand views',
    body:'Judged on selling efficiency, not reach. A creator with 20,000 views and a $500 GPM is worth more than one with 200,000 views and a $40 GPM. Run the fit checklist before agreeing any fee.',
    fields:['followers','avgViews','gpm','avgGmv','retention','audience','contact','fee'],
    pill:'p-a'
  }
};

/* GPM benchmarks */
const GPM_BANDS = [
  { min:511, label:'Elite',    tone:'p-g', note:'At or above the elite benchmark. A fixed fee is rational.' },
  { min:300, label:'Solid',    tone:'p-v', note:'Solid baseline for skincare. Balanced terms are reasonable.' },
  { min:200, label:'Testable', tone:'p-a', note:'Above the minimum bar for a paid test. Keep the fixed fee low.' },
  { min:0,   label:'Unproven', tone:'p-r', note:'Below $200 or unknown. Commission-only, or no deal yet.' }
];

/* The 10-factor Tick & Check checklist */
const FIT_FACTORS = [
  { k:'niche',    cat:'Brand fit',  name:'Niche focus',    test:'Content is more than 70% skincare or beauty', critical:false },
  { k:'tone',     cat:'Brand fit',  name:'Brand tone',     test:'Professional and trustworthy — pharma-grade alignment', critical:false },
  { k:'iq',       cat:'Technical',  name:'Ingredient IQ',  test:'Can explain technical terms such as Ceramided™ technology', critical:true },
  { k:'problem',  cat:'Technical',  name:'Problem solver', test:'Addresses real skin concerns — acne, barrier — on stream', critical:false },
  { k:'skin',     cat:'Visuals',    name:'Real skin',      test:'Minimal filtering. Actual skin texture is visible', critical:true },
  { k:'demo',     cat:'Visuals',    name:'Demo skill',     test:'Demonstrates texture and absorption clearly', critical:false },
  { k:'chat',     cat:'Engagement', name:'Active chat',    test:'Comments are about the product or skin concerns', critical:false },
  { k:'retention',cat:'Engagement', name:'Retention',      test:'Average view time above five minutes', critical:false },
  { k:'gpm',      cat:'Data',       name:'Past GPM',       test:'Proven GPM above $200 on beauty products', critical:false },
  { k:'cart',     cat:'Data',       name:'Conversion',     test:'High add-to-cart rate in previous sessions', critical:false }
];

/* Contribution margin the break-even figures assume.
   The guide's numbers ($625 / $4,688 / $25,000) all
   resolve to fee ÷ 0.32 — so a fee is recovered out
   of 32c in each GMV dollar, not out of the 25%
   commission. Change this if the real margin differs. */
const BE_MARGIN = 0.32;

/* Fee scenarios, selected by fit score */
const FEE_SCENARIOS = [
  { k:'s1', name:'Test', phase:'Low risk', min:5, max:7,
    fee:200, comm:25, breakeven:625, tone:'p-a',
    why:'Shows potential but has no proven record in technical skincare. Test their ingredient knowledge and conversion without committing real money up front.' },
  { k:'s2', name:'Balanced', phase:'Growth', min:8, max:9,
    fee:1500, comm:25, breakeven:4688, tone:'p-v',
    why:'A professional with an aligned audience and proven conversion data. A safe bet for the core range.' },
  { k:'s3', name:'Mega', phase:'High growth', min:10, max:10,
    fee:8000, comm:25, breakeven:25000, tone:'p-g',
    why:'Elite only — every box ticked plus a verified history of delivering GMV above $50k per stream. This is for market dominance, not testing.' },
  { k:'s0', name:'Commission only', phase:'No fixed fee', min:0, max:4,
    fee:0, comm:25, breakeven:0, tone:'p-r',
    why:'Too many gaps, or GPM unknown. Commission only, or walk away. A fixed fee here is not rational.' }
];

/* Creator lifecycle. Approved and later stages lock against deletion. */
const KOL_PIPE = [
  { k:'sourced',   name:'Sourced',    desc:'Found and verified. Not yet contacted.', locked:false },
  { k:'contacted', name:'Contacted',  desc:'Outreach sent. Awaiting a reply.',       locked:false },
  { k:'negotiating',name:'Negotiating',desc:'Terms under discussion.',               locked:false },
  { k:'approved',  name:'Approved',   desc:'Terms agreed and signed off.',           locked:true  },
  { k:'scheduled', name:'Scheduled',  desc:'Booked into the calendar.',              locked:true  },
  { k:'live',      name:'Delivering', desc:'Content or streams running.',            locked:true  },
  { k:'done',      name:'Complete',   desc:'All deliverables met.',                  locked:true  },
  { k:'declined',  name:'Declined',   desc:'Not proceeding. Kept for the record.',   locked:true  }
];

/* Coarse warm/cold view over KOL_PIPE, for prioritizing who actually
   matters right now over the long tail of unanswered outreach. */
const KOL_WARMTH = [
  { k:'confirmed', name:'Confirmed', stages:['approved','scheduled'] },
  { k:'completed', name:'Completed', stages:['live','done'] },
  { k:'warm',      name:'Warm',      stages:['contacted','negotiating'] },
  { k:'cold',      name:'Cold',      stages:['sourced'] }
];

const CONTACT_METHODS = ['DM','Email','Other'];
const COMMISSION_OPTIONS = ['15%','20%','25%','30%'];
const PRODUCT_SEEDED_OPTIONS = ['Not sent','Sent','Received & confirmed'];

/* Primary audience market — set only once a team member has actually
   checked platform-native audience insights and confirmed this market
   makes up over half the audience. Left unset by default (including on
   CSV import) rather than guessed, matching this hub's verified-data-only
   rule for every other field. */
const AUDIENCE_MARKETS = ['SG','TH','MY','Other'];

/* Content curation — the step between briefing a creator and putting them
   on the schedule. Team can move a draft through review; only an admin
   can make the actual approve/reject call, same "Administrator: Approvals"
   split as everywhere else in this hub. */
const CONTENT_TYPES = ['Video','Image','Carousel'];
const CONTENT_STATUSES = [
  { k:'draft',     name:'Draft' },
  { k:'submitted', name:'Submitted' },
  { k:'review',    name:'In review' },
  { k:'approved',  name:'Approved' },
  { k:'rejected',  name:'Rejected' }
];

/* Deliverable types per creator type */
const DELIVERABLES = {
  ugc: ['Day 0 first impression','Day 14 check-in','Day 30 verdict','Store review','Photo set','Spark Ad rights'],
  live:['Live session','Pre-stream promo post','Post-stream clip','Store review','Spark Ad rights']
};

/* ── Partnership angles — how a KOL brief differs by SKU and by what it's
   actually proving. A "review" isn't one angle; distinguish creators by which
   job the content does for a new, unproven brand:
     - Diary/challenge  → prove a change happened, over time, on real skin.
     - Reversal         → name a problem another product/step causes, solve it.
     - Replacement      → argue against an existing habit on cost/effort, not just liking the product.
     - Trust-first-touch→ answer "is this brand even legit" before anything else.
     - Habit/wear-test  → prove it survives daily real conditions, not a single demo.
     - Continuity       → only credible from someone already shown using the range, not a first post.
   Each maps to one SKU (via role in SKUS), one message-stack lane, and one
   proof requirement — so briefs stay claim-compliant per this project's
   evidence-based-claims rule (CLAUDE.md) instead of drifting into invented numbers. */
const PARTNERSHIP_ANGLES = [
  {
    id:'vitc-challenge', skuId:'vitc', name:'The Vitamin C Challenge',
    type:'Diary / challenge', lane:'Credibility',
    condition:'Dullness and uneven tone — the thing a first-time buyer needs to see resolve, not just hear claimed.',
    format:'Day 0 → Day 14 → Day 30 diary, same lighting and angle every time so the comparison is honest.',
    fitCreator:'ugc',
    proof:'Unedited close-up skin photos or video at each check-in. No numeric brightening claim unless a validated benchmark is on file — say "visibly brighter to me," not a percentage.',
    steps:[
      'Book all three DELIVERABLES.ugc check-in dates up front (Day 0, Day 14, Day 30) as one Schedule series, not three separate asks.',
      'Day 0 post sets the baseline on camera — bare face, same spot, same time of day.',
      'Day 14 and Day 30 repeat the exact framing so the audience can compare, not just take her word.',
      'Caption states what changed in her own words — texture, tone, how it felt — never a clinical percentage.'
    ],
    cta:'Shop link in bio + affiliate code for the Vitamin C Ampoule.'
  },
  {
    id:'calm-antiretinol', skuId:'calm', name:'What I Use After Retinol Nights',
    type:'Reversal', lane:'Differentiation',
    condition:'Redness, peeling and purging caused by actives (retinol, exfoliants) — a problem the audience already has, from something else.',
    format:'Problem → agitate → solve: show the irritation honestly, then the calming step, then the recovery.',
    fitCreator:'either',
    proof:'Creator must actually have acne-prone or reactive skin on camera (Fit checklist: Real skin, Ingredient IQ) — this angle fails on a clear-skin creator, however large.',
    steps:[
      'Only brief creators who pass the Real skin and Ingredient IQ fit checks — this angle is void without a genuinely reactive complexion on screen.',
      'Open on the real trigger (a retinol night, a strong exfoliant) and the visible reaction the next morning.',
      'Apply Trouble Calming Ampoule on camera, name the ACZERO™ mechanism in plain language, not a borrowed clinical term.',
      'Never say "cures" or "treats" acne — mechanism and visible calming only, per the claim policy.',
      'Livestream Q&A works well here for objection-handling ("does this actually work with retinol") in real time.'
    ],
    cta:'Pin the calming-step routine order in comments; affiliate code for the Calming Ampoule.'
  },
  {
    id:'water-replacement', skuId:'water', name:'Your Sheet Mask Replacement',
    type:'Replacement', lane:'Differentiation',
    condition:'Habit and cost, not a skin problem — the audience already masks; the pitch is why the jar replaces that habit.',
    format:'Routine-swap: replace the usual mask step with Water Cream on camera, same night, side by side.',
    fitCreator:'ugc',
    proof:'A cost-per-use comparison is only postable once the team verifies real numbers (jar size vs. a real mask multipack price) — never estimate this on camera. Absorption demo (no pilling, no residue) stands on its own without a cost claim.',
    steps:[
      'Confirm with an administrator whether a verified cost-per-use figure exists before scripting any cost claim — if not, run the angle on absorption and convenience only.',
      'Show the swap in real time: mask routine out, Water Cream in, same evening.',
      'Demo absorption on camera — apply, wait, show no pilling or residue.',
      'Message lane is Differentiation: "a ceramide delivery system," not a generic moisturizer claim.'
    ],
    cta:'Shop link for Water Cream; suggest the Hero Repair Duo bundle (with Vitamin C Ampoule) as the next step.'
  },
  {
    id:'sun-habit', skuId:'sun', name:'The No-White-Cast Daily Test',
    type:'Habit / wear-test', lane:'Educational',
    condition:'Skepticism that SPF is wearable daily under makeup — the barrier to habit formation, not a skin condition.',
    format:'GRWM wear-test across a real day — application, under makeup, midday recheck.',
    fitCreator:'either',
    proof:'State the SPF/PA rating exactly as printed on packaging — that is a fact, not a claim. No invented "reef-safe" or dermatologist-endorsement language unless documented.',
    steps:[
      'Apply on bare, then show it going on under makeup without pilling.',
      'Midday recheck on camera — this is the actual proof point, not the application shot.',
      'Good livestream add-on: low price point, easy to bundle into a cart during a hero-SKU session.'
    ],
    cta:'Store review deliverable + affiliate code; cross-sell into the Starter Duo bundle.'
  },
  {
    id:'toner-trust', skuId:'toner', name:'Why I Started Here — First Impression',
    type:'Trust / first touch', lane:'Emotional',
    condition:'Brand skepticism itself — "who is d.nuvo" — since this is the cold-entry SKU for people who don\'t know the brand yet.',
    format:'Unboxing and first-use reaction, ingredient label read included on camera.',
    fitCreator:'ugc',
    proof:'Genuine unboxing, not a staged studio shot — packaging, ingredient list, and an honest first reaction are the whole proof, no results claim needed yet.',
    steps:[
      'Book the Day 0 first impression deliverable specifically — this angle is about arrival, not results.',
      'Read the ingredient list on camera; name-check Fresh Ceramided™ in her own words.',
      'Honest first-touch reaction to texture and scent — skepticism is allowed and reads as credible.'
    ],
    cta:'Frame as "the first thing to try" — link the Starter Duo bundle, not a single SKU.'
  },
  {
    id:'eye-continuity', skuId:'eye', name:'What I Added After 3 Months',
    type:'Continuity', lane:'Credibility',
    condition:'None new — this angle only works layered onto an existing, already-proven relationship with the brand.',
    format:'Routine-update post from a creator who has already posted earlier check-ins on other SKUs.',
    fitCreator:'ugc',
    proof:'Only brief creators with a prior completed deliverable on file (check their Schedule history) — a first-touch creator posting this has no credibility to draw on.',
    steps:[
      'Pull from Schedule: only offer this angle to a creator with a prior Complete deliverable.',
      'Frame explicitly as a routine addition, not a new discovery — "three months in, here\'s what I added."',
      'Never brief this as a cold-traffic asset — per the SKU\'s Upsell role, it is for warm/existing-buyer content and email, not paid acquisition.'
    ],
    cta:'No cold shop link — pair with an existing-buyer email or loyalty livestream moment.'
  }
];

/* Where a message can be sent from */
const SEND_ROUTES = [
  { k:'email',   name:'My email',        hint:'Opens your mail app with the message ready' },
  { k:'tiktok',  name:'TikTok inbox',    hint:'Opens TikTok messages — paste the copied text',
    url:'https://www.tiktok.com/messages' },
  { k:'shopee',  name:'Shopee chat',     hint:'Opens Shopee Seller chat — paste the copied text',
    url:'https://seller.shopee.sg/webchat' },
  { k:'ig',      name:'Instagram DM',    hint:'Opens Instagram direct — paste the copied text',
    url:'https://www.instagram.com/direct/inbox/' },
  { k:'copy',    name:'Copy only',       hint:'Copies to your clipboard' },
  { k:'download',name:'Download as file',hint:'Saves the message as a .txt file' }
];


/* Break-even from first principles, so a changed fee
   updates the figure instead of going stale.        */
function breakEvenFor(fee){ return Math.round(fee / BE_MARGIN); }
