# Plan: Revise Slide Deck to Mirror Services Page

## Context

The current slide deck (`docs/slides/index.html`) is developer/open-source focused (Architecture, Quick Start, `make` commands, "Star on GitHub"). The business is selling **AI automation services** — the deck should mirror `ruska.ai/services` and tell a business-services story: Problem, Solution, Services, Credibility, CTA.

**Use case**: 1-minute pitch at a local Build Night. No pricing on slides — direct people to `ruska.ai/services` or the discovery call for details.

Additionally, the logo on the title slides is offset to the left due to a CSS conflict.

---

## Bug Fix: Logo Centering

**Root cause**: `display: block` (Tailwind `block` class) on the `<img>` prevents reveal.js's `text-align: center` from centering the image. `mx-auto` alone isn't sufficient within reveal.js sections.

**Fix**: Remove `block` from the class list on both title slide `<img>` elements (lines 116 and 130).

---

## New Slide Structure (12 slides, same count)

| # | Current | New | Action |
|---|---------|-----|--------|
| 1 | Title (Open-Source, Apache 2.0) | Title (Accepting New Clients) | MODIFY |
| 2 | Title Expanded (tech pills) | Title Expanded (trust pills) | MODIFY |
| 3 | The Challenge (dev pain) | The Problem (business pain) | MODIFY |
| 4 | Orchestra Solves This (LangGraph/MCP/A2A) | What I Do (Identify / Build / Maintain) | MODIFY |
| 5 | Architecture (nested: backend/frontend/mermaid) | Automation in Action (nested: mermaid workflow, engagement model, pipeline diagram) | MODIFY |
| 6 | Key Features (check-list) | What's Included (6 services) | MODIFY |
| 7 | Quick Start (nested: clone/docker/backend/frontend) | What Can Be Automated (nested: intro + 6-category grid) | MODIFY |
| 8 | Dev Commands | Tech Ecosystem (pill badges) | MODIFY |
| 9 | Documentation (3 link cards) | How It Works (3-step cards, no pricing) | MODIFY |
| 10 | CTA (Star GitHub) | Trust & Credibility (You Own Everything / Full Transparency) | MODIFY |
| 11 | Thank You | Thank You | KEEP |
| 12 | Thank You Expanded | Thank You (updated links) | MODIFY |

---

## Slide Content Details

### Slide 1 — Title (auto-animate, hero-bg)
- Logo (centered, `block` class removed)
- Badge: pulsing green dot + **"Accepting New Clients"** (replaces GitHub icon + "Open-Source - Apache 2.0")
- H1: **"Ruska AI"** (replaces "Orchestra")
- P: **"AI Automation Built & Maintained For Your Business"**

### Slide 2 — Title Expanded (auto-animate, hero-bg)
- Same logo (smaller), badge, H1, P
- Pills: **"Enterprise-Grade" | "Not Vibe Coded" | "You Own Everything"** (replaces Self-hosted/LangGraph/MCP/A2A)
- Links: `ruska.ai` | `ruska.ai/services` | `cal.com/ruska-ai/ai-audit`

### Slide 3 — The Problem (zoom transition)
- H2: "The Problem"
- P: "AI is moving too fast for most businesses to keep up."
- Check-list (fragments):
  - New AI tools every week — you don't know which to trust
  - No in-house AI or security expertise
  - Most "AI solutions" are vibe-coded prototypes that break in production
  - You need automation that works reliably, not impressive demos
- Closing: "You need a trusted partner. **That's where I come in.**" (green accent)

### Slide 4 — What I Do (3 cards)
- H2: "What I Do"
- Three cards with icons (reuse existing card pattern):
  1. **Identify** — Map workflows, find automation opportunities
  2. **Build** — Production-ready systems with proven AI tools
  3. **Maintain** — Monitor, improve, add automations as you grow
- Closing: "Real automation systems, not chatbots. Built with battle-tested tools."

### Slide 5 — Automation in Action (nested vertical)
- **5a Parent**: H2 "Automation in Action" + "Press down arrow for details"
- **5b Mermaid workflow** (replaces Backend Stack):
  ```
  graph TD
    T["Trigger Detected"] --> AI["AI Agent Processing"]
    AI --> CRM["CRM Updated"]
    CRM --> R["Resolved in 30s"]
  ```
- **5c Engagement Model YAML** (replaces Frontend Stack):
  ```yaml
  engagement:
    step_1: Discovery Call (free, 30 min)
    step_2: Custom Setup (2-4 weeks)
    step_3: Ongoing Retainer (monthly)
    ownership: You own everything
  ```
- **5d Pipeline Mermaid** (replaces Full Stack Overview):
  ```
  graph LR
    D["Discovery Call"] --> S["Custom Setup"]
    S --> R["Retainer"]
    R -->|Continuous| I["Improvement"]
    I --> R
  ```

### Slide 6 — What's Included (check-list)
- H2: "What's Included"
- 6 services as check-list items (fragment fade-up):
  - **Custom Automation Setup** — 2-4 weeks
  - **Workflow Integration** — 1-2 weeks
  - **Monitoring & Analytics** — 1 week
  - **Security & Data Privacy** — 1-2 weeks
  - **Infrastructure Management** — Ongoing
  - **Continuous Improvement** — Ongoing

### Slide 7 — What Can Be Automated (nested vertical)
- **7a Parent**: H2 + "If you spend 10+ hours/week on repetitive work, it can probably be automated."
- **7b Grid**: 6 cards (3x2 flex layout, existing card pattern):
  - Customer Support, Data Processing, Lead Management
  - Property Management, Content Operations, Internal Ops

### Slide 8 — Tech Ecosystem (pill badges)
- H2: "Our Technology Ecosystem"
- P: "We integrate with tools you already know and trust"
- Two rows of pills (green-accent border/bg pattern):
  - Claude Code | OpenClaw | Orchestra | Anthropic Claude | LangGraph | MCP
  - Python | Docker | Supabase | Next.js | PostgreSQL | Tailwind CSS

### Slide 9 — How It Works (3-step cards, no pricing)
- H2: "How It Works"
- Three cards (fragment fade-up):
  1. **Discovery Call** (green border highlight) — "Map your workflows and identify what's worth automating. Free. 30 min."
  2. **Custom Setup** — "I build your automation system with proven AI tools. Typically 2-4 weeks."
  3. **Ongoing Retainer** — "I maintain, improve, and add new automations as your needs evolve."
- P: "Details at ruska.ai/services"

### Slide 10 — Trust & Credibility
- H2: "Why Ruska AI"
- Two green-border trust cards (fragment fade-up):
  1. **"You Own Everything"** — No lock-in, no hostage data
  2. **"Full Transparency"** — Regular updates, full visibility, no surprise invoices
- Founder line: "Ryan Eggleston. Shipping production software long before AI wrote its first line of code."

### Slide 11 — CTA (gradient background, zoom transition)
- H2: "Ready to **automate**?" (green accent on "automate")
- Primary btn: **"Book a Discovery Call"** -> `https://cal.com/ruska-ai/ai-audit`
- Secondary btn: **"Visit ruska.ai/services"** -> `https://ruska.ai/services`
- P: "Free 30-minute call. No pressure. No commitment."
- P: "Or email: reggleston@ruska.ai"

### Slide 12 — Thank You (auto-animate pair)
- Keep slide 12a as-is
- Update 12b links: `ruska.ai` | `ruska.ai/services` | `cal.com/ruska-ai/ai-audit`

---

## 1-Minute Pitch Path (Build Night)

For a rapid pitch, advance through only the top-level horizontal slides (skip nested verticals with down-arrow). The key path:

**Slide 1** (Title) -> **2** (Trust pills) -> **3** (Problem) -> **4** (What I Do) -> skip 5-8 -> **9** (How It Works) -> **10** (Trust) -> **11** (CTA)

Slides 5-8 serve as backup/deep-dive content for Q&A or longer presentations.

---

## Also Update
- `<title>` tag: "Orchestra - AI Agent Orchestration Platform" -> **"Ruska AI - AI Automation Services"**

## What's Preserved (No Changes)
- All `<head>` imports (fonts, Tailwind, reveal.js, highlight theme)
- All CSS custom properties and style block
- Mermaid initialization with dark theme + Montserrat
- Reveal.js config (hash, progress, transitions, plugins)
- Logo image path: `images/ruska_logo_200.png`

## Content Source
- `website/src/app/services/page.tsx` — all copy, pricing, service definitions, trust blocks

---

## Verification (agent-browser)

```bash
python -m http.server 8080 --directory docs &
agent-browser open http://localhost:8080/slides/
agent-browser set viewport 1920 1080
```

| Check | Method |
|---|---|
| Logo centered | Screenshot title slide, visually confirm centered |
| No console errors | `agent-browser errors` on title + mermaid slides |
| Badge says "Accepting New Clients" | `agent-browser snapshot` on slide 1 |
| Trust pills on slide 2 | snapshot after ArrowRight |
| Mermaid renders (no raw text) | Navigate to slide 5b, snapshot |
| CTA links to cal.com | snapshot slide 11 |
| 12 slides total | Navigate through all |

---

## Implementation Order

1. Fix logo bug (remove `block` from both `<img>` tags)
2. Update `<title>` tag
3. Rewrite slides 1-4 (title, problem, solution)
4. Rewrite slides 5 nested vertical (mermaid workflow + engagement model)
5. Rewrite slides 6-8 (services, categories, tech)
6. Rewrite slides 9-10 (how it works, trust)
7. Rewrite slide 11 CTA + slide 12 links
8. Verify with agent-browser
