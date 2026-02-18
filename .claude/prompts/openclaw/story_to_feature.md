---
folder: "orchestra"
repo: "ruska-ai/orchestra"
plan_template_path: "orchestra/.github/ISSUE_TEMPLATE/feature_request.yml"
user_story: "As a ROLE, I want CAPABILITY so that BENEFIT."
---

## WORKFLOW:
1. Read $plan_template_path
2. Create `git branch` and `git worktree` per the Metadata instructions from template.
3. Using plan mode draft a strategy to resolve the user story, commit to branch and draft PR.
4. Load the prd skill to create a PRD from the original plan, which will generate a prd.md in orchestra/tasks  directory
5. Load the ralph skill and use it to convert the prd.md that was saved to the orchestra/tasks directory to generate the corresponding .ralph/prd.json
    a. _ALWAYS_ validate that last step in the `.ralph/prd.json` is to verify if there are any remaining changes in the workspace by running `git status`
        i. If remaining changes, commit and push to branch so they will become **visible** in the Github PR.
6. Commit the `tasks` folder to the commit history to save the prd, and then push to branch so plan & prd will **appear** in PR on Github.
7. Then execute `make ralph` from the orchestra folder inside a tmux session titled `feat-[issue#]`

## WARNINGS:
Check the `gh issues` if there is already a related ticket for this story to avoid duplication.
Check to environment to prevent duplication **prior** to starting the gh issue, worktree, or branch.