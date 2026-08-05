# CLAUDE.md - d.nuvo planner project guidance

## Purpose

This file defines how contributors and AI assistants should operate this project while preserving:

1. Clean look and feel
2. Simple user flow
3. Role-safe execution
4. Evidence-based claims

This project is a static dashboard (no build step). Keep changes minimal and explainable.

## Product and branding guardrails

1. Keep d.nuvo branding consistent with existing logo usage already embedded in the UI.
2. Do not add visual clutter or extra panels that reduce clarity.
3. Prioritize readable hierarchy: gate -> view -> panel -> action.
4. Preserve current role gate model (team vs admin) and workflow simplicity.

## UX rules for dashboard edits

1. Every new interaction must have one obvious entry point.
2. Do not introduce hidden side effects across roles.
3. Default to progressive disclosure: show summary first, details on click.
4. Keep copy short and directive in buttons and labels.
5. If adding fields, specify owner role and required evidence.

## Role operating model

### Media planner

Focus areas:
- Media plan
- Allocation by product
- Reporting actuals

Definition of done:
- Monthly budget is mapped to SKU/bundle lines
- Gate progression impact is documented in session notes

### Social / KOL manager

Focus areas:
- KOL hub pipeline
- Verified metric capture
- Creator messaging and scheduling

Definition of done:
- No invented metrics
- Every numeric claim has a source URL
- Proposed changes routed through approvals

### Event and retail lead

Focus areas:
- Events
- Calendar alignment
- Retail campaign windows

Definition of done:
- Event dates synchronized with creator drops and retail promotions
- Post-event impact reflected in Reporting

### Content creative manager

Focus areas:
- Strategy
- Pricing narrative consistency
- Channel-adapted message frameworks

Definition of done:
- Creative hooks map to one KPI and one gate objective per month
- Claims are legal-review ready

### Administrator

Focus areas:
- Approvals
- Pricing floor protection
- Session governance

Definition of done:
- Decision trail exists for changes to price, budget, or targets
- Team exports remain cost-safe

## KOL skill enhancement blueprint

Use a strict verified-data loop:

1. Research
- Pull creator profile metrics from platform-native sources first.
- If tooling is used, require source URL for each field.

2. Qualification
- Evaluate fit by role:
  - UGC creator: review density, authenticity, claim-compliance
  - Livestream creator: GPM quality, retention signal, audience match

3. Deployment
- Schedule creator drops by monthly gate objective.
- Pair each drop with one CTA and one conversion path.

4. Measurement
- Track by creator: views, clicks, conversion, net sales impact.
- Record what changed in a session note after each cycle.

## Competitor intelligence framework (6 closest by product type)

Baseline competitor set for ceramide/barrier positioning:

1. CeraVe
2. Cetaphil
3. COSRX
4. CERADAN
5. ILLIYOON
6. Suu Balm

Data collection rhythm:

1. Weekly capture:
- Current listed price
- Promo price and promo mechanic
- Hero claim and proof device
- Channel emphasis (Shopee, TikTok Shop, Shopify/DTC, Lazada)

2. Monthly synthesis:
- Price ladder shifts
- Messaging saturation map
- Offer mechanic trends

3. Output requirement:
- One page snapshot for KOL manager and media planner
- Recommended d.nuvo response by channel

## Messaging architecture for d.nuvo

Use this four-layer stack in creator briefs and content scripts.

1. Emotional
- Your skin deserves ingredients that go deeper.

2. Educational
- Stop moisturizing the surface. Start feeding the layers.

3. Credibility
- 15x deeper (or validated benchmark), not a claim - a patented system.

4. Differentiation
- A ceramide delivery system designed for absorption plus repair.

Claim policy:
- Never publish numbers without approved proof.
- If validation is pending, use non-numeric mechanism language.

## 6-month coordinated channel plan (long-tail)

### Shopee

Primary role: conversion and repeat purchase

- Months 1-2: reviews and PDP proof depth
- Months 3-4: bundle conversion and retargeting
- Months 5-6: repeat-buyer packs and event spikes

### TikTok Shop

Primary role: discovery + social proof

- Months 1-2: creator education hooks and demo content
- Months 3-4: live-selling around winning claims
- Months 5-6: segmented creator clusters and replay sales

### Shopify

Primary role: authority and lifecycle retention

- Months 1-2: science pages and trust proof modules
- Months 3-4: conversion landing pages + flows
- Months 5-6: loyalty and routine upsell

### Lazada

Primary role: incremental marketplace reach

- Months 1-2: listing hygiene and search readiness
- Months 3-4: campaign-event amplification
- Months 5-6: value-set strategy with MSRP discipline

## Source and evidence notes

1. The provided Manus share link requires authentication and was not machine-readable in this session.
2. Competitor baseline should be treated as a working draft and refreshed directly from live SG channels before campaign launch decisions.

## File conventions

1. Keep root static files as-is unless a feature requires change.
2. Put strategy updates in README and this CLAUDE.md.
3. Do not store secrets in this repository.
