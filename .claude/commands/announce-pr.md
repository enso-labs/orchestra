# Announce PR

Generate user-value focused social media announcements (LinkedIn and X.com) for a pull request. This command invokes the pr-announcer agent to transform technical changes into compelling posts that communicate HOW changes benefit users and connect to ruska.ai's mission.

## Variables

PR_IDENTIFIER: $ARGUMENTS
REVIEW_MODE: --review flag (optional)

## Philosophy

**Communicate VALUE and IMPACT, not features.**

This command extracts USER VALUE from technical changes - what can users NOW DO, what time is saved, what friction is removed. Posts NEVER include technical implementation details, file paths, or "we added X" language.

## Workflow

1. _CHECK_ for review mode:
   - IF `--review` flag present: Display recent announcements and feedback patterns
   - ELSE: Continue to PR analysis

2. _DETERMINE_ PR source from PR_IDENTIFIER:
   - IF empty/not provided: Use current branch's latest commit
   - IF numeric (e.g., "123"): Treat as PR number in current repository
   - IF URL format (e.g., "https://github.com/org/repo/pull/123"): Extract org, repo, and PR number
   - IF branch name: Use that branch's HEAD commit

3. _CHECK_ for existing feedback:
   - Look for feedback file at `.claude/outputs/pr-announcements/YYYY-MM/PR-{number}-feedback.md`
   - IF exists: Read and incorporate lessons learned

4. _INVOKE_ pr-announcer agent:
   - Pass PR identifier and context
   - Agent will gather PR diff (internal use only - NEVER in posts)
   - Agent extracts USER VALUE, maps to ICP, drafts posts

5. _PERSIST_ announcement output:
   - Create directory if needed: `.claude/outputs/pr-announcements/YYYY-MM/`
   - Save to: `PR-{number}-{YYYY-MM-DD}.md`
   - Update index at: `.claude/outputs/pr-announcements/index.md`

6. _PRESENT_ copy-ready posts:
   - LinkedIn post (500-1200 characters)
   - X.com post (220-280 characters)
   - Character counts displayed
   - Ready to copy without modification

## Output Format

Present the announcements in this structure:

```markdown
## PR Announcement: #{number}

**Generated**: {YYYY-MM-DD HH:MM}
**PR**: [{title}]({url})
**Primary ICP**: {which ICP benefits most}
**Value Theme**: {main theme: time savings, control, guided autonomy, etc.}

---

### Value Summary
{2-3 sentences on what users can NOW do that they couldn't before}

---

### LinkedIn Post
**Characters**: {count}/1200

{post content - user-value focused, zero technical details}

---

### X.com Post
**Characters**: {count}/280

{post content - punchy hook, single compelling benefit}

---

### ICP Resonance Check
- [ ] Primary ICP would say "this is for me"
- [ ] Focuses on outcomes, not features
- [ ] Connects to ruska.ai mission theme
- [ ] Zero technical implementation details
- [ ] Written from user perspective (you/your)

---

### Copy Instructions
1. LinkedIn: Copy entire post above, paste directly into LinkedIn
2. X.com: Copy entire post above, paste directly into X.com
3. Both posts are ready to publish without modification

---

**Saved to**: `.claude/outputs/pr-announcements/{YYYY-MM}/PR-{number}-{YYYY-MM-DD}.md`
```

## Review Mode

When invoked with `--review` flag:

1. _READ_ last 3-5 announcements from `.claude/outputs/pr-announcements/index.md`
2. _ANALYZE_ patterns:
   - What value themes were used (time savings, control, etc.)
   - Which ICPs were targeted
   - What hooks were effective (check feedback files)
   - What repetitive patterns to avoid
3. _DISPLAY_ summary with recommendations for next announcement

**Review Output**:
```markdown
## Recent PR Announcements Review

### Last 5 Announcements
1. PR #{number} - {ICP} - {theme} - {engagement notes if available}
2. PR #{number} - {ICP} - {theme} - {engagement notes if available}
...

### Pattern Analysis
- **Most Used ICP**: {which ICP appears most}
- **Most Used Themes**: {themes used}
- **Effective Hooks**: {what resonated from feedback}
- **To Avoid**: {repetitive patterns}

### Recommendations
- Consider targeting {underused ICP}
- Try {unused theme} angle
- Avoid hooks similar to: {recent patterns}
```

## Persisted Output File Template

Each announcement is saved to:
`.claude/outputs/pr-announcements/YYYY-MM/PR-{number}-{YYYY-MM-DD}.md`

**File Structure**:
```markdown
# PR Announcement: #{number}

**Generated**: {YYYY-MM-DD HH:MM}
**PR**: [{title}]({url})
**Primary ICP**: {which ICP benefits most}
**Value Theme**: {main theme: time savings, control, etc.}

---

## Value Summary
{2-3 sentences on what users can NOW do}

---

## LinkedIn Post
**Characters**: {count}/1200

{post content}

---

## X.com Post
**Characters**: {count}/280

{post content}

---

## ICP Resonance Check
- [ ] Primary ICP would say "this is for me"
- [ ] Focuses on outcomes, not features
- [ ] Connects to ruska.ai mission theme
- [ ] Zero technical implementation details
- [ ] Written from user perspective (you/your)

---

## Internal Analysis (Not for Publication)

### User Problem Solved
{What friction or limitation did users experience?}

### Value Delivered
{What can users now do? What time/effort is saved?}

### ICP Mapping Rationale
{Why this ICP was chosen, what pain point addressed}

### Mission Connection
{How this supports ruska.ai's mission themes}

---

## Feedback
_After posting, note what worked:_

**Date Posted**: {YYYY-MM-DD}

**Engagement Level**:
- LinkedIn: {likes/comments/shares}
- X.com: {likes/retweets/replies}

**What Resonated**:
- {positive comments or reactions}

**What to Adjust**:
- {learnings for next announcement}

**Keywords/Hooks That Worked**:
- {specific phrases that got attention}
```

## Index Management

Update `.claude/outputs/pr-announcements/index.md` after each announcement:

```markdown
# PR Announcements Index

## 2026-01

| PR | Date | Title | ICP | Theme | File | Feedback |
|----|------|-------|-----|-------|------|----------|
| #651 | 2026-01-10 | File Treeview | Developers | AI Workforce | [PR-651-2026-01-10.md](2026-01/PR-651-2026-01-10.md) | ⭐⭐⭐ |
| ... | ... | ... | ... | ... | ... | ... |
```

## Example Invocations

```bash
# Review recent announcements before creating new one
/announce-pr --review

# Announce current branch/commit
/announce-pr

# Announce specific PR by number
/announce-pr 651

# Announce PR from URL
/announce-pr https://github.com/ruska-ai/orchestra/pull/651

# Announce specific branch
/announce-pr feat/650-file-treeview-sidebar
```

## Agent Invocation Details

This command invokes the **pr-announcer** agent with the following context:

**Agent Role**: Value communicator who transforms technical changes into user-benefit focused announcements

**What the Agent Does**:
1. Gathers PR diff (internal only - NEVER exposed in posts)
2. Identifies USER PROBLEM being solved
3. Maps improvements to specific ICPs
4. Extracts VALUE DELIVERED (what users can now do)
5. Connects to ruska.ai mission themes
6. Drafts LinkedIn and X.com posts focused on outcomes
7. Validates against quality checklist
8. Persists output with feedback template

**What the Agent NEVER Does**:
- List files changed or technical implementation details
- Use "we added" or "this PR includes" language
- Include code patterns, architectures, or jargon
- Write from company perspective (we/our) instead of user perspective (you/your)

## Error Handling

- **No PR found**: _REPORT_ "Could not find PR. Please specify a valid PR number, URL, or branch name."
- **No diff available**: _REPORT_ "No changes detected. Please ensure the branch has commits or the PR exists."
- **gh CLI error**: _REPORT_ error message and suggest checking GitHub authentication (`gh auth status`)
- **Invalid URL format**: _REPORT_ "Invalid PR URL format. Expected: https://github.com/org/repo/pull/NUMBER"
- **No user value identified**: _REPORT_ "This PR may not warrant a public announcement. Consider batching with related improvements."

## Quality Standards

Every announcement must pass these checks:

**Value Focus**:
- [ ] Post answers "what's in it for me?" for the user
- [ ] Zero technical implementation details included
- [ ] Written from user's perspective (you/your), not company's (we/our)

**ICP Resonance**:
- [ ] Target ICP clearly identified with reasoning
- [ ] Target ICP would feel "this is for me"
- [ ] Language matches ICP's motivations and pain points

**Mission Alignment**:
- [ ] Connects to at least one ruska.ai messaging theme
- [ ] Supports "regain ownership of your time" mission

**Engagement Potential**:
- [ ] Hook addresses a real pain point or aspiration
- [ ] Creates desire to try the feature
- [ ] CTA encourages meaningful action

## Report

After generating announcements, summarize:
- PR number and title
- Primary ICP targeted
- Value theme used
- Character counts for both posts
- File save location
- Confirmation that posts are copy-ready
- Reminder to add feedback after posting
