# Announce PR

Generate social media announcements (LinkedIn and X.com) for a pull request by analyzing the PR diff and creating engaging, copy-ready posts.

## Variables

PR_IDENTIFIER: $ARGUMENTS

## Workflow

1. _DETERMINE_ PR source from PR_IDENTIFIER:
   - IF empty/not provided: Use current branch's latest commit
   - IF numeric (e.g., "123"): Treat as PR number in current repository
   - IF URL format (e.g., "https://github.com/org/repo/pull/123"): Extract org, repo, and PR number
   - IF branch name: Use that branch's HEAD commit

2. _FETCH_ the PR information and diff:
   - IF PR_IDENTIFIER is a number: RUN `gh pr view {PR_IDENTIFIER} --json title,body,url,headRefName`
   - IF PR_IDENTIFIER is a URL: Parse URL and RUN `gh pr view {PR_NUMBER} --repo {ORG}/{REPO} --json title,body,url,headRefName`
   - IF current branch/commit: RUN `git log -1 --pretty=format:"%s%n%n%b"` for commit message and `git diff HEAD~1..HEAD` for diff

3. _EXTRACT_ commit context:
   - IF PR exists: RUN `gh pr diff {PR_IDENTIFIER}` to get full diff
   - IF branch/commit: Use `git diff {BASE_BRANCH}..HEAD` where BASE_BRANCH defaults to "development"

4. _ANALYZE_ the diff to understand:
   - What features were added or modified
   - What problems were solved
   - What technical improvements were made
   - Key files and areas affected (backend, frontend, infrastructure, etc.)
   - Overall impact and scope

5. _GENERATE_ social media announcements:
   - Create a LinkedIn post (professional, detailed, 1300-3000 characters)
   - Create an X.com post (concise, engaging, under 280 characters)
   - Include relevant hashtags and mentions
   - Highlight the key technical achievement
   - Focus on developer value and impact

6. _FORMAT_ the output for easy copy-paste:
   - Clear section headers for LinkedIn and X.com
   - Proper line breaks and formatting
   - Character counts displayed
   - Ready to copy without modification

## Output Format

Present the announcements in this structure:

```markdown
## PR Announcement Generated

### PR Information
- **Title**: [PR Title]
- **URL**: [PR URL]
- **Branch**: [Branch Name]
- **Files Changed**: [Number] files
- **Key Areas**: [Affected areas]

---

### LinkedIn Post (Professional)
**Character Count**: [count]/3000

[LinkedIn post content with proper formatting, line breaks, and hashtags]

---

### X.com Post (Concise)
**Character Count**: [count]/280

[X.com post content with hashtags]

---

### Copy Instructions
1. LinkedIn: Copy entire post above, paste directly into LinkedIn
2. X.com: Copy entire post above, paste directly into X.com
3. Both posts are ready to publish without modification
```

## LinkedIn Post Guidelines

**Structure**:
- Hook line (attention-grabbing first sentence)
- Problem or context (what was needed)
- Solution implemented (technical details)
- Impact/value (why it matters)
- Call-to-action with link
- Relevant hashtags

**Style**:
- Professional but approachable
- Technical details without jargon overload
- Show the "why" not just the "what"
- 1300-3000 characters (optimal engagement range)

**Hashtags** (3-5):
- #OpenSource
- #DeveloperTools
- #AI #AgentDevelopment
- #SoftwareEngineering
- [Domain-specific tags based on PR content]

## X.com Post Guidelines

**Structure**:
- Single impactful sentence
- Key technical achievement or value
- Link to PR
- 1-2 hashtags

**Style**:
- Concise and punchy
- Focus on one core message
- Under 280 characters (including URL)
- Use emojis sparingly (1-2 max)

**Hashtags** (1-2):
- #BuildInPublic or #OpenSource
- [One domain-specific tag]

## Example Invocations

```bash
# Announce current branch/commit
/announce-pr

# Announce specific PR by number
/announce-pr 651

# Announce PR from URL
/announce-pr https://github.com/ruska-ai/orchestra/pull/651

# Announce specific branch
/announce-pr feat/650-file-treeview-sidebar
```

## Error Handling

- **No PR found**: _REPORT_ "Could not find PR. Please specify a valid PR number, URL, or branch name."
- **No diff available**: _REPORT_ "No changes detected. Please ensure the branch has commits or the PR exists."
- **gh CLI error**: _REPORT_ error message and suggest checking GitHub authentication (`gh auth status`)
- **Invalid URL format**: _REPORT_ "Invalid PR URL format. Expected: https://github.com/org/repo/pull/NUMBER"

## Technical Considerations

### Diff Analysis Strategy
When analyzing the PR diff:
1. **Backend changes**: Identify API endpoints, database schemas, new features
2. **Frontend changes**: Identify UI components, user-facing features, UX improvements
3. **Infrastructure**: Identify deployment, configuration, performance changes
4. **Documentation**: Note README updates, API docs, tutorials
5. **Tests**: Note test coverage and quality improvements

### Content Tone Calibration
- **Major features**: Emphasize innovation and impact
- **Bug fixes**: Highlight improved stability and user experience
- **Refactoring**: Focus on code quality and maintainability
- **Performance**: Quantify improvements when possible
- **Documentation**: Emphasize developer experience

## Report

Summarize the announcement generation including:
- PR title and number
- URL to the PR
- Character counts for both posts
- Key themes highlighted
- Confirmation that posts are ready to copy
