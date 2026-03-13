---
title: Docker
summary: Docker Compose quickstart
---

Run Paperclip in Docker without installing Node or pnpm locally.

## Compose Quickstart (Recommended)

```sh
docker compose -f docker-compose.quickstart.yml up --build
```

Open [http://localhost:3100](http://localhost:3100).

Defaults:

- Host port: `3100`
- Data directory: `./data/docker-paperclip`

Override with environment variables:

```sh
PAPERCLIP_PORT=3200 PAPERCLIP_DATA_DIR=./data/pc \
  docker compose -f docker-compose.quickstart.yml up --build
```

## Manual Docker Build

```sh
docker build -t paperclip-local .
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

## Data Persistence

All data is persisted under the bind mount (`./data/docker-paperclip`):

- Embedded PostgreSQL data
- Uploaded assets
- Local secrets key
- Agent workspace data

## Claude and Codex Adapters in Docker

The Docker image pre-installs:

- `claude` (Anthropic Claude Code CLI)
- `codex` (OpenAI Codex CLI)

Pass API keys to enable local adapter runs inside the container:

```sh
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-... \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

Without API keys, the app runs normally — adapter environment checks will surface missing prerequisites.

## Multi-Service Compose (agent-phi stack)

`install/docker/` contains a production-grade compose setup designed for running Paperclip alongside other agent services (OpenFang, QMD memory layer, etc.) on a shared Docker network.

```sh
cd install/docker
cp .env.example .env   # edit as needed
docker compose up -d --build
```

### Shared network

All services join a single bridge network (`agent-phi` by default). Services can reach each other by container name — for example Paperclip can call OpenFang at `http://openfang:4200`.

Configure the network name in `.env`:

```
DOCKER_NETWORK_NAME=agent-phi
```

### Persistent state

Each service stores state under a configurable base directory, namespaced by service:

```
${AGENT_STATE_BASE}/
  paperclip/     ← Paperclip config, DB, secrets, workspaces
  openfang/      ← OpenFang state
  qmd/           ← QMD memory layer state
```

Configure the base path in `.env`:

```
AGENT_STATE_BASE=/home/youruser/agent-phi/state
```

Directories are created automatically on first run (`bind.create_host_path: true`).

### Key variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_STATE_BASE` | `${HOME}/agent-phi/state` | Root for all persistent state |
| `DOCKER_NETWORK_NAME` | `agent-phi` | Shared Docker bridge network name |
| `PAPERCLIP_PORT` | `3100` | Host port for Paperclip |
| `PAPERCLIP_DEPLOYMENT_MODE` | `authenticated` | `local_trusted` or `authenticated` |
| `PAPERCLIP_PUBLIC_URL` | `http://localhost:3100` | Public base URL (used for auth callbacks) |
| `OPENFANG_PORT` | `4200` | Host port for OpenFang (when enabled) |

### Adding OpenFang

The `openfang` service is included as a commented-out stub. Once the OpenFang image is available, uncomment it in `docker-compose.yml` and set `OPENFANG_IMAGE_TAG` in `.env`. Configure agents using the [`openfang_http` adapter](/adapters/openfang-http) with `baseUrl: http://openfang:4200`.
