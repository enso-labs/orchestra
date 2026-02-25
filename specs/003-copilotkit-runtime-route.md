# Spec 003: Create CopilotKit Runtime API Route

## Objective
Create a Next.js API route that connects the CopilotKit frontend SDK to the Orchestra LangGraph agent backend.

## Files Created
- `frontend/src/app/api/copilotkit/route.ts` (or equivalent based on project's routing structure)

## Implementation
```typescript
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";

const serviceAdapter = new ExperimentalEmptyAdapter();

const runtime = new CopilotRuntime({
  agents: {
    deepagent: new LangGraphAgent({
      deploymentUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8124",
      graphId: "deepagent",
    }),
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
```

## Notes
- The `graphId` should match Orchestra's LangGraph graph registration (check `agents/__init__.py` for `graph_id="deepagent"`)
- The deployment URL points to the Orchestra backend
- Authentication may need to be forwarded from the request headers

## Tests
- Route responds to POST requests
- Route connects to backend agent successfully
- Typecheck passes
