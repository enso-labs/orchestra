import re
from pydantic import BaseModel, Field
from langchain_core.tools import tool

class MathCalculatorInput(BaseModel):
    expression: str = Field(
        description="Mathematical expression to evaluate (e.g., '2 + 3 * 4', '(10 - 5) / 2')"
    )


@tool(args_schema=MathCalculatorInput)
def math_calculator(expression: str) -> str:
    """
    Calculate mathematical expressions including addition, subtraction, multiplication, division, and parentheses.
    """
    try:
        # Safe evaluation of basic math expressions
        # Only allow numbers, operators, parentheses, and basic math functions
        sanitized = re.sub(r"[^0-9+\-*/().\s]", "", expression)

        # Basic validation
        if not sanitized or sanitized.strip() == "":
            return "Error: Invalid math expression"

        # Use eval with restricted scope for safe evaluation
        result = eval(sanitized, {"__builtins__": {}}, {})

        if not isinstance(result, (int, float)) or not (
            isinstance(result, int) or isinstance(result, float)
        ):
            return "Error: Result is not a valid number"

        if (
            not (result == result) or result == float("inf") or result == -float("inf")
        ):  # Check for NaN or inf
            return "Error: Result is not a valid number"

        return f"{expression} = {result}"
    except Exception:
        return f"Error: Invalid math expression - {expression}"