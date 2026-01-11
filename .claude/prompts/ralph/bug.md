DESCRIPTION: Agent does not see files added at conversation init

"Fix bug: $DESCRIPTION

Steps to Reproduce:
1. In the ChatInput component open the FileEditorPanel
2. Create a file called CONTEXT.md, write "This sky is purple"
3. Send query to ChatInput asking it to read the CONTEXT.md file and return contents.

Tools Available:
- Playwright MCP (Use to validate your final changes)

Steps:
1. Reproduce the bug
2. Identify root cause
3. Implement fix
4. Write regression test
5. Verify fix works
6. Check no new issues introduced

After 15 iterations if not fixed:
- Document blocking issues
- List attempted approaches
- Suggest alternatives

Output <promise>FIXED</promise> when resolved." --max-iterations 20 --completion-promise "FIXED"