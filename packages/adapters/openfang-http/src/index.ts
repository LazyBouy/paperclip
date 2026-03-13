export const type = "openfang_http";
export const label = "OpenFang";

export const models: Array<{ id: string; label: string }> = [
  { id: "researcher", label: "Researcher" },
  { id: "lead", label: "Lead" },
  { id: "collector", label: "Collector" },
  { id: "predictor", label: "Predictor" },
  { id: "twitter", label: "Twitter" },
  { id: "browser", label: "Browser" },
  { id: "clip", label: "Clip" },
];

export const agentConfigurationDoc = `# openfang_http agent configuration

Adapter: openfang_http

Use when:
- You want Paperclip to invoke an OpenFang agent over its OpenAI-compatible HTTP API.
- OpenFang is running locally or remotely and exposes /v1/chat/completions.
- You want to drive one of OpenFang's "Hands" (researcher, lead, collector, predictor, twitter, browser, clip).

Don't use when:
- You need a locally-spawned process (use process or claude_local).
- OpenFang is not installed or reachable from the Paperclip server host.

Core fields:
- baseUrl (string, required): OpenFang base URL, e.g. http://127.0.0.1:4200
- hand (string, required): OpenFang Hand (agent type) to activate — researcher, lead, collector, predictor, twitter, browser, or clip
- apiKey (string, optional): API key sent as Bearer token in Authorization header
- promptTemplate (string, optional): Template for the user message sent to OpenFang; supports {{agent.name}}, {{context.wakeReason}}, etc.
- timeoutSec (number, optional): Request timeout in seconds (default 300)

Notes:
- The hand maps to the OpenAI \`model\` field in the /v1/chat/completions request.
- Paperclip context (runId, agentId, issueId, wakeReason) is forwarded in the request metadata.
- Streaming (SSE) is used by default to pipe OpenFang output in real time to the heartbeat log.
- OpenFang must be running (\`openfang start\`) before agents will connect.
`;
