# Plan: Social Media Campaign — Harness Design Launch

## Context

Anthropic published ["Harness design for long-running application development"](https://www.anthropic.com/engineering/harness-design-long-running-apps) on March 24, 2026. Orchestra is implementing the core patterns from this research. This campaign positions Ruska AI / Orchestra as the open-source platform that ships Anthropic's harness design research as usable infrastructure.

## Campaign Structure

4-week arc: React → Build → Demo → Lead. Each week has LinkedIn + X/Twitter content.

## Week 1: The Signal Post (React to the Article)

Timing: Within 48 hours of article publication (March 24–26, 2026).

### LinkedIn

> Anthropic just published something that validates exactly what we've been building at Orchestra.
>
> Their finding: the single biggest unlock for long-running AI agents isn't a better model — it's separating the agent doing the work from the agent judging the work.
>
> They built a GAN-inspired loop: generator creates, evaluator critiques, generator improves. The evaluator uses Playwright to actually click through the running app before scoring it. Results: a one-sentence prompt produced a fully functional DAW in the browser over a 4-hour autonomous session.
>
> Three takeaways that change how you should think about AI engineering:
>
> 1. Agents are terrible at self-evaluation. They confidently praise their own mediocre work. You NEED a separate evaluator.
>
> 2. A planner that expands a short prompt into a full spec produces dramatically more ambitious output than feeding the raw prompt to a coding agent.
>
> 3. Every piece of your harness encodes an assumption about what the model can't do. When a new model drops, strip what's no longer needed and add new capabilities.
>
> We're shipping evaluator agents, planner agents, and harness templates in Orchestra's next release. Open-source, self-hostable.
>
> Link to Anthropic's article in comments. Link to our issues tracking this work in comments.
>
> #AIEngineering #AgentOrchestration #OpenSource

### X/Twitter Thread (6 tweets)

> 🧵 Anthropic just dropped a blueprint for making AI agents actually good at building software.
>
> The key insight most people will miss: it's not about the model. It's about the harness.
>
> Here's what matters and what we're building on top of it → (1/6)

> The core problem: agents are TERRIBLE at judging their own work.
>
> Ask Claude to evaluate code it just wrote? It'll tell you it's great. Even when a human can see it's obviously broken.
>
> The fix: separate the generator from the evaluator. Like GANs, but for coding agents. (2/6)

> Anthropic's results:
>
> Solo agent: 20 min, $9 → broken game, gameplay doesn't work
>
> Planner + Generator + Evaluator: 6 hrs, $200 → working game maker with sprite editor, level editor, AI features, playable game
>
> Same model. Different harness. (3/6)

> The evaluator uses Playwright to actually CLICK THROUGH the running app before scoring.
>
> It caught bugs like: "Rectangle fill tool only places tiles at drag start/end instead of filling the region."
>
> That's not code review. That's automated QA with real interaction. (4/6)

> What Opus 4.6 changed: context anxiety (agents wrapping up early) largely disappeared.
>
> So they stripped the sprint decomposition, dropped context resets, simplified to planner + generator + evaluator.
>
> Lesson: every harness component is an assumption. Re-test with each new model. (5/6)

> We're shipping all of this in @OrchestraAI:
>
> ✓ Evaluator agents with grading criteria
> ✓ Planner agents for spec expansion
> ✓ Harness templates (solo, reviewed, full harness)
> ✓ Per-run cost tracking
> ✓ Context resets with structured handoff
>
> Open source. Self-host for free.
>
> github.com/ruska-ai/orchestra (6/6)

### Engagement Tactics

- Reply to Anthropic's own post about the article with your take + Orchestra link
- Tag @AnthropicAI and the article author Prithvi Rajasekaran
- Post the thread during US morning hours (9-11am ET) for maximum reach

---

## Week 2: The Build-in-Public Post (Show Implementation)

Timing: ~1 week after Week 1.

### LinkedIn

> Building evaluator agents for Orchestra this week. Here's what I learned that surprised me.
>
> Getting an LLM to evaluate another LLM's output is harder than it sounds. The evaluator wants to be generous. It identifies real bugs, then talks itself into deciding they're not a big deal.
>
> What actually works:
>
> → Concrete grading criteria, not vibes. "Does this follow our design principles?" beats "Is this beautiful?" every time.
>
> → Weight the criteria that matter. Claude already gets craft and functionality right by default. The win is pushing on originality and design quality — the things where AI output tends toward bland defaults.
>
> → Few-shot calibration. Give the evaluator examples of what a 3/5 vs 5/5 looks like. Without this, scores drift.
>
> → Prompt the evaluator to be skeptical. Literally tell it to look for problems, not confirm quality. The natural leniency of LLMs means you have to overcorrect.
>
> Shipping this as a first-class feature in Orchestra — any assistant can have an evaluator attached with custom criteria and pass/fail thresholds.
>
> Issue tracking the work: [link]
>
> #BuildInPublic #AIEngineering #OpenSource

### X/Twitter Thread (4 tweets)

> Building evaluator agents for @OrchestraAI this week.
>
> The hardest part isn't the architecture — it's getting the evaluator to actually be critical.
>
> LLMs want to be nice. Even when grading other LLMs. 🧵 (1/4)

> What works:
>
> 1. Concrete criteria > vibes ("follows design principles" > "looks good")
> 2. Weight what matters (originality > craft — Claude already handles craft)
> 3. Few-shot calibration (show what 3/5 vs 5/5 looks like)
> 4. Explicitly prompt skepticism (2/4)

> The schema we landed on:
>
> EvaluationCriterion: name, description, weight, threshold
> EvaluatorConfig: assistant_id, criteria, max_iterations
>
> Any assistant can have an evaluator attached. Generator → Evaluate → Retry if below threshold.
>
> Simple pattern, massive quality lift. (3/4)

> Shipping in Orchestra's next release. Open source.
>
> If you're building agents that produce artifacts (code, designs, docs), you need this pattern.
>
> Star the repo, issues are public: github.com/ruska-ai/orchestra (4/4)

---

## Week 3: The Demo Post (Show Results)

Timing: ~2 weeks after Week 1. Requires a working demo.

### LinkedIn

> I gave Orchestra a one-sentence prompt and let it run for 3 hours.
>
> Prompt: "Build a project management app with Kanban boards and AI task prioritization."
>
> What the planner agent expanded it into: 14 features across 8 sprints — Kanban boards, calendar view, AI priority scoring, team workload balancing, Slack integration, analytics dashboard, and more.
>
> What the evaluator caught that the generator missed:
> → Drag-and-drop only worked for the first column
> → The AI prioritization endpoint was stubbed but never wired to the UI
> → Mobile viewport was completely broken below 768px
>
> After 3 evaluation rounds, the generator fixed all three. Total cost: ~$85.
>
> This is what harness design gets you. Same model, 10x better output.
>
> Full demo video in comments. All built on Orchestra — open source, self-hostable.
>
> #AIEngineering #AgentOrchestration #DemoDay

### X/Twitter

> One prompt → 3 hours → full project management app.
>
> Planner expanded it to 14 features.
> Generator built it.
> Evaluator caught 3 critical bugs.
> Generator fixed them.
>
> Total cost: ~$85.
>
> Built on Orchestra (open source).
>
> Demo 🧵👇 [video]

---

## Week 4: Thought Leadership (Lessons & Vision)

### LinkedIn

> After shipping evaluator agents, planner agents, and harness templates in Orchestra, here's my updated mental model for AI engineering in 2026.
>
> The model is not the product. The harness is the product.
>
> Every harness component encodes an assumption about what the model can't do on its own. Those assumptions have a shelf life. When Opus 4.6 shipped, context resets became unnecessary. Sprints became unnecessary. But evaluator agents became MORE valuable — because the model could now attempt more ambitious things, which meant more surface area for subtle bugs.
>
> The interesting work isn't "wrap an API and ship." It's finding the novel combination of model capabilities + orchestration patterns that produces output beyond what either achieves alone.
>
> Three things I'd tell any AI engineer building agents today:
>
> 1. Separate generation from evaluation. Always.
> 2. Let a planner dream big before your generator starts typing.
> 3. Re-examine your harness with every model release. Strip what's dead weight. Add what the new capability unlocks.
>
> This is what we're building at Ruska AI with Orchestra. Open-source agent orchestration that gets better as the models get better.
>
> #AIEngineering #Agents #OpenSource #BuildInPublic

### X/Twitter

> Updated mental model after shipping harness design features in Orchestra:
>
> The model is not the product. The harness is the product.
>
> Every scaffold component has a shelf life. Strip what's dead, add what new models unlock.
>
> The space of interesting harness combinations doesn't shrink. It moves.

---

## Hashtag Strategy

**LinkedIn:** #AIEngineering #AgentOrchestration #OpenSource #BuildInPublic #LangChain #Anthropic

**X/Twitter:** #AIEngineering #OpenSource #BuildInPublic + tag @AnthropicAI on signal post

## Engagement Tactics

- Reply to Anthropic's own post with your take + link to Orchestra issues
- Tag the article author (Prithvi Rajasekaran) when referencing specific findings
- Cross-post demo videos natively to both platforms (LinkedIn native video gets 3x reach)
- Pin the Week 1 thread on X profile for the full month
- Share each GitHub issue individually in: LangChain Discord, AI Engineer Slack, Indie Hackers
- Engage with every comment in the first 2 hours (algorithm signal)
