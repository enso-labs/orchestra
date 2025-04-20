## shell_local
The `shell_local` is a function that allows running shell commands. It accepts a list of strings, where each string represents a command to be executed.

### Parameters
- `commands`: A list of strings, each representing a shell command to be executed.

### Usage
```python
@tool
def shell_local(commands: list[str]):
    """Run a shell commands. Commands is a list of strings, each representing a command to run. Avoid interactive commands."""
    shell_tool = ShellTool()
    output = shell_tool.run({"commands": commands})
    print(output)
    return output
```