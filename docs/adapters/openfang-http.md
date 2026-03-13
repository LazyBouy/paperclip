---
title: OpenFang HTTP
summary: OpenFang autonomous agent adapter via HTTP
---

The `openfang_http` adapter connects Paperclip to an [OpenFang](https://github.com/RightNow-AI/openfang) instance running as a separate service. It uses OpenFang's OpenAI-compatible REST API to invoke a specific "Hand" (agent specialisation) and streams the response back in real time.

## When to Use

- OpenFang is deployed as a standalone service (local container, remote server)
- You want to leverage OpenFang's specialised Hands (researcher, browser, predictor, etc.)
- You need real-time streaming output visible in the run viewer

## When Not to Use

- If you need a full coding agent with file-system access (use `claude_local`, `codex_local`, or `gemini_local`)
- If OpenFang is not running or reachable from the Paperclip host

## Prerequisites

- OpenFang running and reachable (e.g. `http://localhost:4200` or `http://openfang:4200` inside Docker)
- Optional: an API key if your OpenFang instance requires authentication

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `baseUrl` | string | Yes | Base URL of the OpenFang service (e.g. `http://openfang:4200`) |
| `hand` | string | Yes | OpenFang Hand to invoke (see [Hands](#hands) below) |
| `promptTemplate` | string | No | Prompt sent as the user message for every run |
| `payloadTemplate` | object | No | Extra fields merged into the OpenAI-compatible request body |
| `timeoutSec` | number | No | Request timeout in seconds (default: 300) |
| `apiKey` | string | No | Bearer token / API key if OpenFang requires auth |

## Hands

OpenFang Hands are specialised agent modes selected via the `model` field of the OpenAI-compatible API.

| Hand | ID | Description |
|------|----|-------------|
| Researcher | `researcher` | Deep web research and synthesis |
| Lead | `lead` | Lead generation and prospecting |
| Collector | `collector` | Structured data collection |
| Predictor | `predictor` | Forecasting and trend analysis |
| Twitter | `twitter` | Twitter/X monitoring and engagement |
| Browser | `browser` | Browser automation and scraping |
| Clip | `clip` | Content clipping and summarisation |

## How It Works

1. Paperclip renders the `promptTemplate` (with `{{variable}}` substitutions) as the user message
2. The adapter sends a streaming POST to `${baseUrl}/v1/chat/completions` with `model` set to the configured `hand`
3. A `metadata.paperclip` block is included in the request body containing `runId`, `agentId`, `companyId`, `issueId`, and `wakeReason` — OpenFang can use this to call back to the Paperclip API
4. The adapter reads the SSE stream, parsing `data: {...}` lines and emitting delta content to the run log in real time
5. Token usage is read from the final chunk's `usage` field and reported to Paperclip for cost tracking
6. The full streamed text is stored as the run `summary`

## Request Body

```json
{
  "model": "researcher",
  "stream": true,
  "messages": [
    { "role": "user", "content": "<rendered prompt>" }
  ],
  "metadata": {
    "paperclip": {
      "runId": "...",
      "agentId": "...",
      "companyId": "...",
      "issueId": "...",
      "wakeReason": "heartbeat"
    }
  }
}
```

Any fields from `payloadTemplate` are shallow-merged into this body before sending.

## Prompt Template Variables

| Variable | Value |
|----------|-------|
| `{{agentId}}` | Agent's ID |
| `{{companyId}}` | Company ID |
| `{{runId}}` | Current run ID |
| `{{agent.name}}` | Agent's display name |
| `{{company.name}}` | Company name |

## Environment Test

The "Test Environment" button in the UI validates:

- `baseUrl` is present and a valid `http`/`https` URL
- `hand` is set
- OpenFang is reachable — probes `${baseUrl}/health` first (5 s timeout), then falls back to `${baseUrl}/v1/models` if no health endpoint is available

## Running with Docker Compose

When Paperclip and OpenFang run as separate containers on the same Docker network, set `baseUrl` to the OpenFang container name:

```
baseUrl: http://openfang:4200
```

See [install/docker/docker-compose.yml](https://github.com/paperclipai/paperclip/blob/master/install/docker/docker-compose.yml) for the full multi-service compose setup. The `openfang` service definition is included as a commented-out block — uncomment it once your OpenFang image is available:

```yaml
openfang:
  image: rightnowai/openfang:latest
  container_name: openfang
  networks:
    - agent
  ports:
    - "${OPENFANG_PORT:-4200}:4200"
```

All services share the `agent-phi` bridge network (configurable via `DOCKER_NETWORK_NAME` in `.env`), so Paperclip can reach OpenFang at `http://openfang:4200` without any extra routing.
