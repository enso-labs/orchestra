# Plan: Ruska AI 1-Page Handout

## Context

The slide deck at `docs/slides/index.html` was just rewritten with a business-services story (12 slides). For Build Night, we also need a **take-home 1-pager** that people can scan after the pitch. The top section distills the presentation into a compact layout. The bottom section shows a screenshot from `chat.ruska.ai/chat` demonstrating Orchestra in action.

**Output**: `docs/slides/onepager.html` — a static HTML page designed for Letter-size print.

---

## Page Layout

```
+----------------------------------------------------------+
| [HEADER] Logo + "Ruska AI" + Tagline + Badge + 3 Pills  |
|----------------------------------------------------------|
| [WHAT I DO]  Identify  |  Build  |  Maintain   (3 cols) |
|----------------------------------------------------------|
| [INCLUDED]  6 services in 3x2 compact grid               |
|----------------------------------------------------------|
| [HOW IT WORKS]  Step 1 → Step 2 → Step 3  (horizontal)  |
|----------------------------------------------------------|
| [TECH] 12 tech pills in 2 rows (green AI / purple infra) |
|----------------------------------------------------------|
| [TRUST] "You Own Everything" | "Full Transparency"       |
|         Ryan Eggleston, Founder                          |
|----------------------------------------------------------|
| [CTA BAR]  cal.com/ruska-ai/ai-audit  |  ruska.ai/services  |  reggleston@ruska.ai |
|----------------------------------------------------------|
| [SCREENSHOT]  Orchestra chat conversation                |
|   caption: "Orchestra — AI Agent Platform | chat.ruska.ai"|
+----------------------------------------------------------+
```

### What's kept vs. dropped from the 12 slides

| Slide | Keep? | Reason |
|-------|-------|--------|
| 1-2 Title | **Header block** | Brand identity + trust pills |
| 3 Problem | **Drop** | Attendee already heard the pitch — space is precious |
| 4 What I Do | **3-col row** | Core value prop in 3 words |
| 5 Automation in Action | **Drop** | Mermaid diagrams don't work in print |
| 6 What's Included | **3x2 grid** | Concrete deliverables |
| 7 What Can Be Automated | **Drop** | Overlaps with services; screenshot demos capability |
| 8 Tech Ecosystem | **Pill rows** | Visual credibility signal |
| 9 How It Works | **3-step row** | Clear engagement path |
| 10 Trust | **2-col block** | Differentiators |
| 11 CTA | **Footer bar** | Actionable URLs (plain text for print) |
| 12 Thank You | **Drop** | Not needed on paper |

---

## Implementation Steps

### Step 1: Capture the chat screenshot

Use `agent-browser` to log into `chat.ruska.ai/chat` as `admin@example.com` / `test1234`:

1. `agent-browser set viewport 1200 800`
2. Navigate to `chat.ruska.ai/chat`, log in
3. Send a short message: **"What is Orchestra?"**
4. Wait for complete response
5. Screenshot to `docs/slides/screenshots/orchestra-chat.png`
6. Verify: dark theme, readable, concise 1-message exchange

### Step 2: Create `docs/slides/onepager.html`

**Tech stack** (reuse from `index.html`):
- Tailwind CDN + same `tailwind.config` (colors, fonts)
- Google Fonts: Montserrat + Space Grotesk
- No JavaScript — pure HTML+CSS

**Print CSS**:
```css
@page { size: letter; margin: 0.4in; }
@media print {
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
```

**Font sizes** (compact for 1-page fit):
- Company name: `text-2xl` (24px)
- Section headings: `text-xs` uppercase tracking-widest
- Body text: `text-[10px]` to `text-[11px]`
- Pills/badges: `text-[9px]`

**Design tokens** — copy from `docs/slides/index.html`:
- Tailwind config block (lines 11-32)
- Color scheme: `#09090b` bg, `#22c55e` green, `#4ade80` green-muted, `#a855f7` purple
- Card pattern: `bg-card border border-[#27272a] rounded-xl`
- Trust block pattern: `border-green-accent/30 bg-green-accent/5`
- Badge: static green dot (no animation for print) + "Accepting New Clients"
- SVG icons for Identify/Build/Maintain: copy from `index.html` lines 172-196

**Sections** (top to bottom, each separated by `border-b border-[#27272a]`):

1. **Header** (~0.8in) — logo inline with h1 + badge, tagline, 3 trust pills
2. **What I Do** (~0.7in) — `grid grid-cols-3`, icon + label + 1-liner per card
3. **What's Included** (~0.5in) — `grid grid-cols-3`, green checkmark + service name (no timelines)
4. **How It Works** (~0.6in) — 3 numbered steps with arrow separators, step 1 green-highlighted
5. **Tech Ecosystem** (~0.4in) — 2 rows of pills (green AI row, purple infra row)
6. **Trust** (~0.4in) — 2-col trust cards + "Ryan Eggleston, Founder"
7. **CTA Bar** (~0.3in) — green-gradient strip with 3 plaintext URLs
8. **Screenshot** (remaining ~3-4in) — `orchestra-chat.png` full-width with caption

### Step 3: Verify

```bash
python -m http.server 8081 --directory docs/slides
agent-browser open http://localhost:8081/onepager.html
agent-browser set viewport 850 1100   # ~Letter proportions
agent-browser screenshot /tmp/onepager-preview.png
agent-browser pdf docs/slides/screenshots/onepager.pdf
```

| Check | Method |
|-------|--------|
| Fits on 1 page | `agent-browser pdf` — verify single page |
| Dark backgrounds print | PDF has dark bg (print-color-adjust) |
| Screenshot readable | Visually confirm chat text is legible |
| All URLs correct | Scan CTA bar for cal.com, ruska.ai, email |
| Logo loads | Check header renders correctly |

---

## Files

| File | Action |
|------|--------|
| `docs/slides/onepager.html` | **CREATE** — the 1-pager |
| `docs/slides/screenshots/orchestra-chat.png` | **CREATE** — captured via agent-browser |
| `docs/slides/index.html` | READ-ONLY — source for design tokens + SVG icons |
| `docs/slides/images/ruska_logo_200.png` | READ-ONLY — referenced in header |

## Content Copy

**Header**: "Ruska AI" / "AI Automation Built & Maintained For Your Business" / Accepting New Clients / Enterprise-Grade | Not Vibe Coded | You Own Everything

**What I Do**: Identify (Map workflows, find automation opportunities) / Build (Production-ready systems with proven AI tools) / Maintain (Monitor, improve, add automations as you grow)

**What's Included**: Custom Automation Setup / Workflow Integration / Monitoring & Analytics / Security & Data Privacy / Infrastructure Management / Continuous Improvement

**How It Works**: 1. Discovery Call (Free, 30 min) → 2. Custom Setup (2-4 weeks) → 3. Ongoing Retainer (Monthly)

**Trust**: "You Own Everything" — No lock-in. Your code, your infrastructure, your IP. / "Full Transparency" — Regular updates. No surprise invoices. / Ryan Eggleston, Founder

**CTA**: cal.com/ruska-ai/ai-audit | ruska.ai/services | reggleston@ruska.ai
