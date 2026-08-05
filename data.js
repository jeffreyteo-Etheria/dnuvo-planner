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
  baseBudget: 2500,
  marginPct: 40,
  reinvestPct: 30,
  startMonth: 'July 2026',
  shopDomain: 'https://dnuvo.com.sg',
  shopPath: '/products/'      // Shopify default. Change if the store uses another pattern.
};

/* ── SKUs. cogs is admin-only; floor derives from it. ── */
const SKUS = [
  { id:'vitc',  name:'Vitamin C Ampoule 15.5%', spec:'Fresh Ceramided™ · 18ml',
    tier:'Core', msrp:56, sale:35, cogs:9,  units:500, handle:'', url:'', urlOk:null,
    role:'Hero', roleNote:'Anchors every Spark Ad and the Hero Repair Duo.' },
  { id:'water', name:'Water Cream 80ml', spec:'Fresh Ceramided™',
    tier:'Core', msrp:51, sale:29, cogs:8,  units:500, handle:'', url:'', urlOk:null,
    role:'Anchor', roleNote:'Bundle partner for the hero. High repeat rate.' },
  { id:'sun',   name:'Aqua C Sun Serum SPF50+', spec:'50ml',
    tier:'Core', msrp:28, sale:19, cogs:5,  units:500, handle:'', url:'', urlOk:null,
    role:'Trial', roleNote:'Lowest barrier. Daily-use habit builds repurchase.' },
  { id:'toner', name:'Essential Toner 200ml', spec:'Fresh Ceramided™',
    tier:'Entry', msrp:45, sale:25, cogs:6, units:500, handle:'', url:'', urlOk:null,
    role:'Cold entry', roleNote:'Editor\u2019s Pick trust signal for first purchase.' },
  { id:'calm',  name:'Trouble Calming Ampoule', spec:'ACZERO™ · 30ml',
    tier:'Core', msrp:64, sale:39, cogs:10, units:500, handle:'', url:'', urlOk:null,
    role:'Premium', roleNote:'Highest ASP. Acne and sensitive niche from M3.' },
  { id:'eye',   name:'Eye Cream 35ml', spec:'Fresh Ceramided™',
    tier:'Core', msrp:56, sale:29, cogs:8,  units:500, handle:'', url:'', urlOk:null,
    role:'Upsell', roleNote:'Email add-on to past buyers. Never a cold-traffic lead.' }
];

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
  { t:'Never below the floor', b:'Floor equals cost times 2.5 plus platform commission plus payment fee. Every promo is checked against it first.' }
];

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
const MONTHS = [
  { k:'M1', label:'M1 Jul', units:200, price:24,
    split:{ tiktok:0,    shopee:0,    google:0,    meta:0,    kol:1.00 },
    media:'Setup only — pixels, listings, bundles', kolWork:'Gift 20 nano creators',
    events:'Creator content day', promo:'Always-on voucher and welcome code live' },
  { k:'M2', label:'M2 Aug', units:300, price:24,
    split:{ tiktok:0.26, shopee:0.26, google:0,    meta:0,    kol:0.48 },
    media:'TikTok and Shopee ads open', kolWork:'One paid micro post',
    events:'Apply for the 9.9 slot', promo:'8.8 sale · first flash deal if the rating gate clears' },
  { k:'M3', label:'M3 Sep', units:450, price:24,
    split:{ tiktok:0.32, shopee:0.27, google:0.15, meta:0,    kol:0.26 },
    media:'Google Shopping added', kolWork:'Two micro plus one macro',
    events:'Apply for 11.11', promo:'9.9 mega sale — full voucher stack' },
  { k:'M4', label:'M4 Oct', units:550, price:24,
    split:{ tiktok:0.31, shopee:0.25, google:0.17, meta:0.06, kol:0.21 },
    media:'Meta retargeting opens', kolWork:'Two micro posts',
    events:'Pharmacy sampling begins', promo:'S$10 off S$70 · replenishment email' },
  { k:'M5', label:'M5 Nov', units:700, price:24,
    split:{ tiktok:0.30, shopee:0.25, google:0.15, meta:0.14, kol:0.16 },
    media:'Maximum budget on proven channels', kolWork:'One macro · live twice weekly',
    events:'Market pop-up with live co-host', promo:'11.11 mega sale — the largest month' },
  { k:'M6', label:'M6 Dec', units:800, price:24,
    split:{ tiktok:0.29, shopee:0.26, google:0.14, meta:0.17, kol:0.14 },
    media:'Scale winners, cut the rest', kolWork:'One macro at the fair',
    events:'Beauty fair booth', promo:'12.12 · festive sets · clearance' }
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
    jump:'strategy',
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
  month:  ['units','price']
};

const FIELD_LABELS = {
  sale:'Sale price', price:'Price', units:'Units target',
  handle:'Shop handle', url:'Shop URL', cogs:'Cost per unit'
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

/* Deliverable types per creator type */
const DELIVERABLES = {
  ugc: ['Day 0 first impression','Day 14 check-in','Day 30 verdict','Store review','Photo set','Spark Ad rights'],
  live:['Live session','Pre-stream promo post','Post-stream clip','Store review','Spark Ad rights']
};

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
