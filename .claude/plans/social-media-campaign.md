# Execution Plan: Social Media Campaign — Harness Design Launch

## Overview

A 4-week marketing campaign (React, Build, Demo, Lead) tied to Anthropic's "Harness design for long-running application development" publication (March 24, 2026). The campaign positions Ruska AI / Orchestra as the open-source platform that ships Anthropic's harness design research as usable infrastructure, driving developer awareness, GitHub engagement, and lead generation.

Full spec: [.claude/specs/social-media-campaign.md](../specs/social-media-campaign.md)

---

## Week-by-Week Milestones

### Week 1: The Signal Post (March 24-26, 2026)

**Objective:** React to Anthropic's article within 48 hours, position Orchestra as the builder.

**Deliverables:**
- [ ] LinkedIn long-form post (finalized copy, reviewed by team)
- [ ] X/Twitter 6-tweet thread (drafted, scheduled)
- [ ] Reply to Anthropic's own post with Orchestra take + link
- [ ] Tag @AnthropicAI and article author Prithvi Rajasekaran
- [ ] Post during US morning hours (9-11am ET)
- [ ] Pin Week 1 thread on X profile

**Dependencies:** None (content-only, references existing repo).

---

### Week 2: The Build-in-Public Post (~March 31-April 2, 2026)

**Objective:** Show evaluator agent implementation learnings, build credibility.

**Deliverables:**
- [ ] LinkedIn post about evaluator agent implementation (finalized copy)
- [ ] X/Twitter 4-tweet thread (drafted, scheduled)
- [ ] Link to relevant GitHub issue(s) tracking evaluator work
- [ ] Cross-post in LangChain Discord, AI Engineer Slack, Indie Hackers

**Dependencies:**
- Evaluator agent feature work should be in progress (at minimum, an open issue/PR to reference)
- Spec: `.claude/specs/evaluator-agent.md`

---

### Week 3: The Demo Post (~April 7-9, 2026)

**Objective:** Showcase a full harness run with real results (planner + generator + evaluator).

**Deliverables:**
- [ ] Working demo of full harness run (planner -> generator -> evaluator loop)
- [ ] Screen recording / demo video of the run
- [ ] LinkedIn post with demo results and cost breakdown
- [ ] X/Twitter post with native video
- [ ] Upload video natively to both platforms (LinkedIn native video gets 3x reach)

**Dependencies:**
- Planner agent feature shipped or in late-stage PR (spec: `.claude/specs/planner-agent.md`)
- Evaluator agent feature shipped or in late-stage PR (spec: `.claude/specs/evaluator-agent.md`)
- Harness templates available (spec: `.claude/specs/harness-templates.md`)
- Cost tracking feature working (spec: `.claude/specs/cost-tracking.md`)

---

### Week 4: Thought Leadership (~April 14-16, 2026)

**Objective:** Synthesize lessons, establish vision, drive long-term positioning.

**Deliverables:**
- [ ] LinkedIn thought leadership post (finalized copy)
- [ ] X/Twitter concise thought piece
- [ ] Optional: blog post on Ruska website expanding on the LinkedIn post

**Dependencies:**
- Weeks 1-3 posts published and engagement data collected
- At least one feature (evaluator or planner) shipped to production

---

## Content Creation Checklist

### Pre-Campaign Setup
- [ ] Confirm Anthropic article is published and publicly accessible
- [ ] Set up link tracking (UTM parameters) for all Orchestra/GitHub links
- [ ] Prepare social media accounts (LinkedIn, X/Twitter) with updated bios referencing harness design
- [ ] Create short-link for GitHub repo to track campaign-driven traffic
- [ ] Identify and follow Anthropic team members and article author on both platforms

### Per-Post Process
- [ ] Draft copy from spec templates
- [ ] Internal review (tone, accuracy, links)
- [ ] Schedule post for optimal timing (9-11am ET weekdays)
- [ ] Prepare reply/engagement templates for common questions
- [ ] Monitor and engage with all comments within first 2 hours of posting

### Assets Needed
- [ ] GitHub issue links for evaluator, planner, harness template features
- [ ] Demo video (Week 3) -- screen recording of full harness run
- [ ] Optional: branded graphics/cards for each post
- [ ] Short bio / boilerplate for Orchestra description

---

## Hashtag Strategy

| Platform | Hashtags |
|----------|----------|
| LinkedIn | #AIEngineering #AgentOrchestration #OpenSource #BuildInPublic #LangChain #Anthropic |
| X/Twitter | #AIEngineering #OpenSource #BuildInPublic + tag @AnthropicAI on signal post |

---

## Engagement Tactics

1. Reply to Anthropic's own post with take + Orchestra link
2. Tag article author (Prithvi Rajasekaran) when referencing specific findings
3. Cross-post demo videos natively to both platforms
4. Pin Week 1 thread on X profile for full month
5. Share each GitHub issue individually in: LangChain Discord, AI Engineer Slack, Indie Hackers
6. Engage with every comment in first 2 hours (algorithm signal)

---

## Metrics to Track

### Awareness Metrics
- LinkedIn post impressions and engagement rate per post
- X/Twitter thread impressions, retweets, and quote tweets
- Profile visits on both platforms during campaign period

### Conversion Metrics
- GitHub repo stars (baseline vs. end of campaign)
- GitHub repo forks during campaign period
- GitHub issue engagement (comments, reactions on linked issues)
- Website traffic from social referrals (UTM tracking)

### Community Metrics
- New Discord/Slack community members attributed to campaign
- Inbound DMs / connection requests from AI engineers
- Mentions/tags by other accounts (organic amplification)

### Content Performance
- Best-performing post (by engagement rate) across the 4 weeks
- Platform comparison (LinkedIn vs. X) for each week's content
- Reply-to-impression ratio (measures conversation quality)

### Lead Generation
- Cal.com booking link clicks (if included in posts)
- Inbound inquiries about Orchestra / Ruska AI services
- Newsletter signups (if applicable)

---

## Risk Mitigation

- **Anthropic article delayed:** Week 1 content is time-sensitive. If article publication shifts, delay the entire arc proportionally.
- **Features not ready for Week 3 demo:** Use staging/development environment for the demo. The demo does not require production-shipped features, only a working end-to-end run.
- **Low engagement on Week 1:** Boost the post with personal network engagement (team likes/comments in first hour). Consider a small LinkedIn ad budget for the signal post.
