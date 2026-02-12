# PRD: Rebrand Services Page + SEO Optimization

## Introduction

The current services page brands heavily around "Claude Code Automation Systems," tying Ruska's service identity to a single vendor's tool. As the AI landscape evolves rapidly, SMBs need a trusted integration partner -- not a reseller for one tool. This rebrand repositions Ruska as "Automation as a Service," mentioning Claude Code, OpenClaw, and Orchestra as technologies Ruska leverages (not the brand itself).

Simultaneously, the site has critical SEO gaps: no robots.txt, no sitemap, no structured data, no OG images, and an outdated root metadata description. This PRD covers both the copy rebrand and SEO infrastructure buildout.

Additionally, the previous Adaptive Business Solutions site (adaptive.biz) had several strong design patterns worth carrying forward -- particularly a scrolling Technology Ecosystem marquee, a detailed service offerings grid, and trust-building sections ("You Own Everything", "Transparency Guarantee"). These elements are adapted for Ruska's brand and integrated into this plan.

## Goals

- Rebrand the services page from "Claude Code Automation Systems" to "Ruska Automation as a Service"
- Position Ruska as a vendor-agnostic AI integration partner
- Maintain Ryan's personal founder voice ("I" / first person)
- Mention Claude Code, OpenClaw, and Orchestra as tools Ruska uses (not the brand)
- Update retainer minimum from $1,000 to $990/mo
- Add robots.txt, sitemap.xml, JSON-LD structured data, and dynamic OG images
- Update root layout metadata and llm.txt with automation/service keywords
- Improve discoverability for "automation", "claude code", and "openclaw" search terms
- Add a Technology Ecosystem section showcasing Ruska's tool stack (inspired by adaptive.biz)
- Add a detailed service offerings grid with timelines and feature bullets
- Add trust-building sections ("You Own Everything", "Transparency Guarantee")

## User Stories

### US-001: Update Services Page Hero Section
**Description:** As a visitor, I want to see "Ruska Automation as a Service" as the hero title so I understand Ruska is the brand (not Claude Code).

**Acceptance Criteria:**
- [ ] Hero title changed from "Claude Code Automation Systems" to "Ruska Automation as a Service" (`page.tsx` line 186)
- [ ] Subtitle changed from "I set up Claude Code as your AI employee. Then I maintain it." to "I build AI automation systems for your business. Then I keep them running and improving." (`page.tsx` lines 195-197)
- [ ] No other hero elements changed (CTA button, scroll indicator stay the same)
- [ ] Typecheck passes

### US-002: Update Problem Section Copy
**Description:** As a visitor, I want the problem section to reflect the AI velocity/expertise gap so I understand why I need a partner.

**Acceptance Criteria:**
- [ ] Lead-in text changed from "You want AI automation for your business." to "AI is moving too fast for most businesses to keep up." (`page.tsx` line 256)
- [ ] Pain point 1: "You don't know where to start" -> "New AI tools launch every week -- you don't know which ones to trust"
- [ ] Pain point 2: "You tried ChatGPT -- it didn't stick" -> "You don't have in-house AI or security expertise"
- [ ] Pain point 3: "You need something that actually runs reliably" -> "Managing infrastructure and keeping systems secure takes specialized knowledge"
- [ ] Pain point 4: "You don't have time to figure it out yourself" -> "You need automation that works reliably, not just impressive demos"
- [ ] Closer changed from "Most AI tools are chat windows. You need a worker." to "You need a trusted partner who lives and breathes this stuff. That's where I come in."
- [ ] Typecheck passes

### US-003: Update Solution Pillars and Closer
**Description:** As a visitor, I want the solution section to be tool-agnostic so I understand Ruska adapts to the best tools.

**Acceptance Criteria:**
- [ ] "Identify" description updated to: "Map your workflows. Find automation opportunities that actually move the needle." (`page.tsx` line 84)
- [ ] "Build" description changed from "Create Claude Code systems that run in production." to "Create production-ready automation systems using proven AI tools and infrastructure." (`page.tsx` line 89)
- [ ] "Maintain" description changed from "Stay on retainer to improve and add new automations." to "Stay on retainer to monitor, improve, and add new automations as your business grows." (`page.tsx` line 94)
- [ ] Solution closer changed from "Not chatbots. Real automation that handles workflows end-to-end." to "Not chatbots. Not consultants who hand you a report and disappear. Real automation systems built with battle-tested tools, secured properly, and maintained long-term." (`page.tsx` lines 326-329)
- [ ] Typecheck passes

### US-004: Update How It Works - Step 2 and Step 3
**Description:** As a visitor, I want the pricing steps to reflect vendor-agnostic language and the new retainer minimum.

**Acceptance Criteria:**
- [ ] Step 2 description changed from "I build your Claude Code automation system." to "I build your custom automation system using proven AI tools and secure infrastructure." (`page.tsx` line 454)
- [ ] Step 3 retainer price changed from "$1,000 - $3,000/mo" to "$990 - $3,000/mo" (`page.tsx` line 491)
- [ ] No changes to Step 1 (Discovery Call) or Step 3 description
- [ ] Typecheck passes

### US-005: Update About Section
**Description:** As a visitor, I want the about section to mention the tools Ruska uses so I see breadth of capability.

**Acceptance Criteria:**
- [ ] About paragraph changed from "Now I help businesses implement Claude Code systems that actually work in production -- not just demos that break after a week." to "Now I help businesses implement production-ready AI automation using tools like Claude Code, OpenClaw, and Orchestra. You get the benefits of cutting-edge AI without the headaches of managing it yourself." (`page.tsx` lines 568-572)
- [ ] All other About section content remains unchanged (name, Orchestra link, location, social links)
- [ ] Typecheck passes

### US-006: Replace FAQ Data
**Description:** As a visitor, I want the FAQ to address service-value questions so I understand why I'd hire Ruska.

**Acceptance Criteria:**
- [ ] Replace existing 6 FAQs with 8 new FAQs (`page.tsx` lines 18-49):
  1. "What exactly is Automation as a Service?" -> "I build AI-powered automation systems for your business, then maintain them. You get the benefits of AI automation without hiring a team or managing the infrastructure yourself."
  2. "Why do I need an integration partner?" -> "AI is moving fast -- new models, tools, and security concerns every month. Most SMBs don't have in-house expertise to vet tools, manage infrastructure, or keep systems secure. I handle all of that so you can focus on your business."
  3. "What tools and technologies does Ruska use?" -> "I leverage best-in-class AI tools like Claude Code, OpenClaw, and our own Orchestra platform. The tech stack adapts to your needs -- you get results, not vendor lock-in."
  4. "Can't I just use ChatGPT for this?" -> "ChatGPT is great for answering questions, but it's not built for production automation. I build systems that run reliably in the background -- handling workflows, processing data, and taking action without someone sitting at a chat window."
  5. "Why a retainer instead of project-based pricing?" -> "AI systems aren't set-and-forget. Your business changes, new tools emerge, and automations need tuning. A retainer means I'm continuously improving your systems, not handing off a project and disappearing."
  6. "How do you handle security and data privacy?" -> "I treat your data like it's mine. All systems follow security best practices: encrypted connections, minimal data exposure, audit trails, and clear data handling policies."
  7. "Do you have case studies?" -> (keep existing answer)
  8. "Do you work with businesses outside Utah?" -> (keep existing answer)
- [ ] Typecheck passes

### US-007: Add Technology Ecosystem Section
**Description:** As a visitor, I want to see a scrolling marquee of tools and technologies Ruska uses so I trust the breadth of their technical capability and understand I'm not locked into one vendor.

**Acceptance Criteria:**
- [ ] New section added between "What Can Be Automated" and "How It Works" sections in `page.tsx`
- [ ] Section heading: "Our Technology Ecosystem" with subheading: "We integrate with tools you already know and trust"
- [ ] Scrolling horizontal marquee (auto-animating, CSS or framer-motion based) displaying tool cards
- [ ] Each tool card shows: icon/logo, tool name, and short descriptor (e.g., "AI coding agent", "Vector database")
- [ ] Tools included (minimum): Claude Code ("AI coding agent"), OpenClaw ("Open-source AI agents"), Orchestra ("Agent orchestration platform"), Anthropic Claude ("Foundation models"), LangGraph ("Multi-agent workflows"), MCP ("Tool protocol standard"), Python ("AI/ML backend"), Docker ("Containerization"), Supabase ("Postgres & vector storage"), Next.js ("Full-stack React"), PostgreSQL ("Relational database"), Tailwind CSS ("Utility-first CSS")
- [ ] Marquee loops infinitely with smooth animation (duplicate items to avoid gaps)
- [ ] Tool data defined as a typed array constant at the top of the file (similar to existing `automationCategories` pattern)
- [ ] Responsive: shows 3-4 cards visible at mobile, 5-6 at desktop
- [ ] Matches existing dark theme styling (border-border, bg-card, text-foreground)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Add Service Offerings Detail Grid
**Description:** As a visitor, I want to see a detailed breakdown of specific services Ruska offers (with timelines and feature bullets) so I understand the full scope of what I'm getting.

**Acceptance Criteria:**
- [ ] New section added after the Solution Pillars section (between "What I Do" and "What Can Be Automated") in `page.tsx`
- [ ] Section heading: "What's Included"
- [ ] 6 service cards in a 3x2 responsive grid (md:grid-cols-3)
- [ ] Each card contains: icon, title, estimated timeline (colored accent text), short description, 3 bullet points with green checkmarks
- [ ] Cards:
  1. **Custom Automation Setup** (2-4 weeks) - "Build production-ready AI automation tailored to your workflows." Bullets: Custom workflow mapping, API & tool integration, Testing & deployment
  2. **Workflow Integration** (1-2 weeks) - "Connect your automation to the tools you already use." Bullets: Multi-platform sync, Real-time triggers, Error handling & retries
  3. **Monitoring & Analytics** (1 week) - "Track automation performance and ROI with clear dashboards." Bullets: Usage analytics, Performance metrics, Cost optimization
  4. **Security & Data Privacy** (1-2 weeks) - "Enterprise-grade security built into every system." Bullets: Encrypted connections, Audit trails, Data handling policies
  5. **Infrastructure Management** (Ongoing) - "Reliable hosting, scaling, and disaster recovery handled for you." Bullets: Auto-scaling, 24/7 monitoring, Backup systems
  6. **Continuous Improvement** (Ongoing) - "New automations and optimizations as your business evolves." Bullets: Feature additions, Performance tuning, New tool adoption
- [ ] Card styling matches existing design system (rounded-xl, border-border, bg-card)
- [ ] Timeline text uses green-400 color
- [ ] Checkmark bullets use green-500 color
- [ ] Service data defined as a typed array constant at the top of the file
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Add Trust-Building Sections
**Description:** As a visitor, I want to see transparency and ownership guarantees so I feel confident hiring Ruska as a long-term partner.

**Acceptance Criteria:**
- [ ] Add two new content blocks inside the "How It Works" section (after the 3 steps, before the founding clients note) in `page.tsx`
- [ ] Block 1 - "You Own Everything": Card with icon, title "You Own Everything", and body text: "Every automation, every integration, every line of configuration -- it's yours. If we part ways, you keep everything. No lock-in, no hostage data, no proprietary black boxes."
- [ ] Block 2 - "Transparency Guarantee": Card with icon, title "Full Transparency", and body text: "You'll always know exactly what I'm building, why, and how much it costs. No surprise invoices, no scope creep without your approval. I send regular progress updates and you have full visibility into every system."
- [ ] Both blocks styled as accent-bordered cards (border-green-500/30 or similar) to visually differentiate from the pricing steps
- [ ] Uses framer-motion fade-in animation consistent with surrounding sections
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Update Services Layout Metadata
**Description:** As a developer, I need updated metadata for the services page so search engines index the correct branding.

**Acceptance Criteria:**
- [ ] Title changed to "Automation as a Service | Ruska AI" (`layout.tsx` line 4)
- [ ] Description changed to "AI automation systems built and maintained for your business. Saint George, UT and beyond." (`layout.tsx` line 6)
- [ ] Keywords updated: remove "Claude Code", "AI employee"; add "automation as a service", "AI integration", "trusted AI partner" (`layout.tsx` lines 7-15)
- [ ] OG title: "Automation as a Service | Ruska AI"
- [ ] OG/Twitter description: "AI automation systems built and maintained for your business. Trusted AI integration partner for SMBs."
- [ ] Typecheck passes

### US-011: Add JSON-LD Structured Data to Services Page
**Description:** As a developer, I need structured data on the services page so search engines display rich results.

**Acceptance Criteria:**
- [ ] Add `<script type="application/ld+json">` inside `<main>` in `page.tsx`
- [ ] JSON-LD contains: `@type: ProfessionalService`, name, description, URL, founder, areaServed, address (Saint George, UT), priceRange ($990 - $5,000), knowsAbout array
- [ ] JSON is valid (no syntax errors)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill: view page source of /services, confirm JSON-LD present

### US-012: Create robots.ts
**Description:** As a developer, I need a robots.txt so search engines know what to crawl.

**Acceptance Criteria:**
- [ ] Create `website/src/app/robots.ts` using Next.js MetadataRoute.Robots convention
- [ ] Rules: userAgent `*`, allow `/`
- [ ] Sitemap URL: `https://ruska.ai/sitemap.xml`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill: navigate to `http://localhost:3000/robots.txt`, confirm valid output

### US-013: Create sitemap.ts
**Description:** As a developer, I need a dynamic sitemap so search engines discover all pages.

**Acceptance Criteria:**
- [ ] Create `website/src/app/sitemap.ts` using Next.js MetadataRoute.Sitemap convention
- [ ] Include static routes: `/`, `/services`, `/blog`
- [ ] Dynamically read blog post slugs from the posts directory and include `/blog/[slug]` entries
- [ ] Each entry has `url`, `lastModified`, `changeFrequency`, `priority`
- [ ] Homepage priority: 1, services: 0.9, blog index: 0.8, blog posts: 0.6
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill: navigate to `http://localhost:3000/sitemap.xml`, confirm valid sitemap with all pages

### US-014: Create Default OG Image
**Description:** As a developer, I need a default OG image so social shares look professional.

**Acceptance Criteria:**
- [ ] Create `website/src/app/opengraph-image.tsx` using Next.js ImageResponse API
- [ ] Image dimensions: 1200x630
- [ ] Dark background (#0a0a0a), green accent (#22c55e)
- [ ] "RUSKA" branding text, tagline: "AI Agent Orchestration Platform"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill: navigate to `http://localhost:3000/opengraph-image`, confirm image renders

### US-015: Create Services OG Image
**Description:** As a developer, I need a services-specific OG image so social shares for the services page have relevant messaging.

**Acceptance Criteria:**
- [ ] Create `website/src/app/services/opengraph-image.tsx` using Next.js ImageResponse API
- [ ] Image dimensions: 1200x630
- [ ] Same dark/green theme as default OG
- [ ] Title: "Ruska Automation as a Service"
- [ ] Subtitle: "AI automation built and maintained for your business"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill: navigate to `http://localhost:3000/services/opengraph-image`, confirm image renders

### US-016: Update Root Layout Metadata
**Description:** As a developer, I need the root layout metadata updated so the entire site has proper SEO descriptions.

**Acceptance Criteria:**
- [ ] `APP_DESCRIPTION` changed from "Steerable Harnesses for DeepAgents" to "AI Agent Orchestration Platform. Build, deploy, and manage AI automation with Orchestra by Ruska AI." (`layout.tsx` line 28)
- [ ] Twitter card changed from "summary" to "summary_large_image" (`layout.tsx` line 57)
- [ ] Add `keywords` to metadata: `["AI automation", "agent orchestration", "Claude Code", "OpenClaw", "Orchestra", "Ruska AI", "LangGraph", "MCP"]`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill: view page source of homepage, confirm updated meta description and keywords

### US-017: Update llm.txt Generator
**Description:** As a developer, I need the llm.txt to include services/automation keywords so LLM crawlers surface Ruska for automation queries.

**Acceptance Criteria:**
- [ ] Add new section after "## Contact" in `generate-llm-txt.mjs` with heading "## Services - Automation as a Service"
- [ ] Section includes: description of managed AI automation, "What We Automate" list (Customer Support, Data Processing, Lead Management, Property Management, Content Operations, Internal Ops), "How It Works" (3 steps with pricing), "Contact for Services" with booking link and email
- [ ] Run `npm run prebuild` successfully
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill: navigate to `http://localhost:3000/llm.txt`, confirm new Services section present

### US-018: Phase 1 Browser Validation - Services Copy Rebrand + New Sections
**Description:** As a developer, I need to validate all copy changes and new sections visually in the browser after Phase 1.

**Acceptance Criteria:**
- [ ] Load agent-browser skill, navigate to `http://localhost:3000/services`
- [ ] Verify hero says "Ruska Automation as a Service"
- [ ] Verify problem section reflects AI velocity / expertise gap messaging
- [ ] Verify Technology Ecosystem marquee is visible and scrolling with tool logos
- [ ] Verify Service Offerings grid shows 6 cards with timelines and checkmark bullets
- [ ] Verify trust-building cards ("You Own Everything", "Full Transparency") appear in How It Works
- [ ] Verify retainer shows $990
- [ ] Verify FAQ has 8 new questions
- [ ] Verify About mentions Claude Code, OpenClaw, Orchestra as tools
- [ ] Screenshot full page for review

### US-019: Phase 2 Browser Validation - SEO Infrastructure
**Description:** As a developer, I need to validate SEO infrastructure works correctly in the browser.

**Acceptance Criteria:**
- [ ] Navigate to `http://localhost:3000/robots.txt` - confirm valid robots.txt output
- [ ] Navigate to `http://localhost:3000/sitemap.xml` - confirm valid sitemap with all pages
- [ ] View page source of homepage - confirm updated meta description and keywords

### US-020: Phase 3 Browser Validation - OG Images + Structured Data
**Description:** As a developer, I need to validate OG images render and structured data is present.

**Acceptance Criteria:**
- [ ] Navigate to `http://localhost:3000/opengraph-image` - confirm default OG renders
- [ ] Navigate to `http://localhost:3000/services/opengraph-image` - confirm services OG renders
- [ ] View page source of `/services` - confirm JSON-LD structured data present

### US-021: Final Build Verification
**Description:** As a developer, I need to confirm the full site builds without errors and no stale branding remains.

**Acceptance Criteria:**
- [ ] `npm run build` in website dir completes with no errors
- [ ] Full page screenshot of `/services` via agent-browser
- [ ] No remaining "Claude Code Automation" as brand name (tool mentions are OK)
- [ ] All CTAs still link to `https://cal.com/ruska-ai/ai-audit`

## Functional Requirements

- FR-1: Replace all instances of "Claude Code Automation Systems" branding with "Ruska Automation as a Service" in the services page
- FR-2: Update all problem-section copy to reflect AI velocity/expertise gap messaging
- FR-3: Update solution pillars to use vendor-agnostic language
- FR-4: Update How It Works Step 2 and Step 3 with new copy and $990 retainer minimum
- FR-5: Update About section to mention Claude Code, OpenClaw, and Orchestra as tools
- FR-6: Replace 6 FAQs with 8 new service-value FAQs
- FR-7: Add scrolling Technology Ecosystem marquee with tool logos, names, and descriptors
- FR-8: Add 6-card Service Offerings detail grid with timelines and feature checklists
- FR-9: Add "You Own Everything" and "Full Transparency" trust-building cards
- FR-10: Update services layout.tsx metadata (title, description, keywords, OG, Twitter)
- FR-11: Add JSON-LD ProfessionalService structured data to services page
- FR-12: Create robots.ts with allow all + sitemap reference
- FR-13: Create sitemap.ts with static routes + dynamic blog posts
- FR-14: Create default OG image (1200x630, dark/green theme, "RUSKA" branding)
- FR-15: Create services OG image (1200x630, dark/green theme, "Automation as a Service")
- FR-16: Update root layout.tsx metadata (description, twitter card, keywords)
- FR-17: Update llm.txt generator with Services section and automation keywords

## Non-Goals

- No changes to automation categories data (already tech-agnostic)
- No changes to CTA button text or booking link URL
- No changes to About section intro (Ryan's name, Orchestra link)
- No changes to location paragraph, social links, or founding clients mention
- No changes to Discovery Call step or Final CTA section
- No new pages or routes beyond the SEO files (robots, sitemap, OG images)
- No blog content changes
- No backend or API changes
- No stats bar (adaptive.biz had "50+ Clients, 200+ Integrations" etc. -- skip until real numbers exist)

## Design Considerations

- OG images use dark background `#0a0a0a` with green accent `#22c55e` to match existing brand
- OG images are 1200x630px (standard social share dimensions)
- All copy maintains Ryan's personal founder voice ("I" / first person)
- FAQ expansion from 6 to 8 items should not affect layout (existing accordion pattern handles variable counts)
- **Technology Ecosystem marquee:** Horizontal auto-scrolling row of tool cards. Dark card backgrounds (bg-card), tool logo/icon at top, name below, short descriptor in muted text. Duplicated items for seamless infinite loop. CSS `@keyframes` or framer-motion for animation. Inspired by adaptive.biz's marquee but adapted to Ruska's dark/green theme.
- **Service Offerings grid:** 3-column grid on desktop, single column on mobile. Each card has a colored icon, bold title, green timeline badge, description paragraph, and 3 green-checkmark bullet items. Matches existing card styling (rounded-xl, border-border, bg-card).
- **Trust cards:** Two side-by-side cards with green accent borders (border-green-500/30), positioned after the 3 pricing steps in How It Works. Uses icons (crown/shield emoji or similar) for visual anchoring.

## Technical Considerations

- **Next.js App Router conventions:** robots.ts and sitemap.ts use Next.js MetadataRoute types for automatic route generation
- **OG images:** Use Next.js `ImageResponse` API (from `next/og`) -- requires edge runtime
- **Sitemap blog posts:** Need to read blog post slugs from the filesystem (check existing blog infrastructure for post directory location)
- **JSON-LD:** Rendered as a `<script>` tag with `dangerouslySetInnerHTML` -- standard Next.js pattern for structured data
- **llm.txt:** Generated at build time via `generate-llm-txt.mjs` script, outputs to `public/llm.txt`
- **Marquee animation:** Use CSS `@keyframes` with `translateX` for performance (GPU-accelerated). Duplicate the tool list in the DOM so the scroll appears seamless. Alternatively, use framer-motion's `animate` with `repeat: Infinity`. Pause on hover is a nice-to-have.
- **Tool logos:** For MVP, use text-based icons or emoji placeholders. Tool logos can be added later as SVGs in `public/images/tools/` directory.

## Success Metrics

- Zero instances of "Claude Code Automation" as brand name on services page (tool mentions OK)
- `npm run build` passes with no errors
- Technology Ecosystem marquee renders and scrolls smoothly
- Service Offerings grid displays all 6 cards with correct content
- Trust cards visible in How It Works section
- robots.txt accessible at /robots.txt
- sitemap.xml accessible at /sitemap.xml with all pages listed
- OG images render at /opengraph-image and /services/opengraph-image
- JSON-LD structured data present in /services page source
- llm.txt includes Services section with automation keywords
- All CTAs link to correct booking URL

## Implementation Order

### Phase 1: Services Page Copy Rebrand + New Sections
**Stories:** US-001 through US-011
**Files:** `page.tsx`, `layout.tsx` (services)
**Validation:** US-018

### Phase 2: SEO Infrastructure
**Stories:** US-012, US-013, US-016
**Files:** `robots.ts` (new), `sitemap.ts` (new), `layout.tsx` (root)
**Validation:** US-019

### Phase 3: OG Images + Structured Data
**Stories:** US-014, US-015
**Files:** `opengraph-image.tsx` (x2, new)
**Validation:** US-020

### Phase 4: llm.txt Update
**Stories:** US-017
**Files:** `generate-llm-txt.mjs`

### Phase 5: Final Build Verification
**Stories:** US-021

## Open Questions

- What is the blog posts directory structure? Need to confirm the path for dynamic sitemap generation (check if posts are in `src/app/blog/posts/`, `public/posts/`, or similar).
- Should the `APP_DEFAULT_TITLE` constant also be updated from "RUSKA - Steerable Harnesses for DeepAgents" or only `APP_DESCRIPTION`?
- Tool logos: should we use emoji/text placeholders for MVP, or source SVG logos before starting? (Recommendation: emoji/text for MVP, swap in real logos later.)
