# Spec 003: RC Tag Automation

## Objective
Automate RC tag creation as the final step after committing changes, enabling QA from deployed environments.

## Requirements
- After the final commit in the ralph workflow, create an RC tag
- Tag naming: `0.1.0-rcNN` (increment from latest RC tag)
- Push the tag to origin automatically
- Add as the last user story / final step in the ralph workflow

## Implementation Notes
- Could be a Makefile target (`make rc-tag`) or script
- Query existing tags to determine next RC number: `git tag | grep rc | sort -V | tail -1`
- Integrate into ralph.sh or as a post-commit step in the PRD

## Acceptance
- [ ] RC tag created automatically after final commit
- [ ] Follows existing naming convention
- [ ] Tag pushed to remote
- [ ] Documented in workflow
