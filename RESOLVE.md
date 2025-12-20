# Resolution: Pydantic ContextSchema Serialization Issue

## Issue Description

An error was encountered during the execution of the agent workflow, specifically related to the serialization of the `ContextSchema` object.

**Error Message:**

```
(Expected none - serialized value may not be as expected [field_name='context', input_value=ContextSchema(model='goog...-preview', user_id=None), input_type=ContextSchema])
```

This error indicates a conflict in how `ContextSchema` (defined as a Pydantic `dataclass`) was being serialized or validated within the LangGraph/LangChain execution context, which primarily expects `pydantic.BaseModel` instances for schema definitions.

## Resolution

The `ContextSchema` class was converted from a Pydantic `dataclass` to a `pydantic.BaseModel`. This ensures better compatibility with the serialization mechanisms used by the orchestration layer.

### Code Changes

**File:** `backend/src/schemas/contexts/__init__.py`

**Before:**

```python
from pydantic.dataclasses import dataclass
from typing import Optional


@dataclass
class ContextSchema:
    model: str
    user_id: Optional[str] = None
```

**After:**

```python
from pydantic import BaseModel
from typing import Optional


class ContextSchema(BaseModel):
    model: str
    user_id: Optional[str] = None
```

This change resolves the serialization ambiguity and aligns with the expected input types for the graph context.
