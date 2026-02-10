import { runAgent, loadConfig } from "@ruska/agent-ts";

const config = loadConfig();
const result = await runAgent("Host ip?", config);
console.log(result);
