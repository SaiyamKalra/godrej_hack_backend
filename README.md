# WareWatch — Backend API

REST API and AI operations service. Handles incident ingestion from the inference service, camera management, incident archival, and an LLM-powered warehouse supervisor agent.

**Stack**: Node.js 22 · Express 5 · TypeScript · Prisma ORM · PostgreSQL 17 · Redis 8 · Elasticsearch 9 · Ollama (qwen3.5:9b)

---

## Setup

### Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build -d
```

### Local Development

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

Requires a running PostgreSQL instance. Redis and Elasticsearch are optional — the server starts without them.

---

## Seeding Demo Cameras

After the backend and fake CCTV server are running:

```bash
node register_videos.js
```

This creates camera records in PostgreSQL and registers each stream with the inference service.

---

## AI Supervisor Agent

The WareWatch AI assistant (`/api/chat`) uses Ollama with tool calling to answer warehouse operations questions. Available tools:

| Tool | Description |
| :--- | :--- |
| `get_recent_alerts` | Query recent violations by severity, camera, or class |
| `get_alert_stats` | Aggregated incident counts and breakdowns |
| `get_cameras` | List active cameras and their status |
| `get_archive_clips` | Retrieve recorded incident clips |
| `database_query` | Read-only warehouse analytics queries |

---

## API Reference

### Alerts

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/alerts/webhook` | — | Webhook receiver for inference service |
| GET | `/api/alerts` | Bearer | List alerts (filterable) |
| GET | `/api/alerts/stats` | Bearer | Alert statistics |
| GET | `/api/alerts/:id` | Bearer | Alert detail with snapshot |
| POST | `/api/alerts/:id/acknowledge` | Bearer | Mark alert resolved |

### Cameras

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/cameras` | Bearer | Register camera |
| GET | `/api/cameras` | Bearer | List cameras |
| GET | `/api/cameras/:id` | Bearer | Camera detail |
| PUT | `/api/cameras/:id` | Bearer | Update camera |
| DELETE | `/api/cameras/:id` | Bearer | Remove camera |

### Monitoring

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/monitoring/stream/:cameraId` | Bearer | Proxy live annotated feed |
| GET | `/api/monitoring/snapshot/:cameraId` | Bearer | Latest annotated frame |

### Archive

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/archive` | Bearer | List incident clips |
| GET | `/api/archive/:id` | Bearer | Clip metadata |
| GET | `/api/archive/:id/video` | Bearer | Stream MP4 clip |

### Chat (AI Assistant)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/chat` | Bearer | Send message, streamed response |
| GET | `/api/chat/recent` | Bearer | Recent conversations |
| GET | `/api/chat/search?q=...` | Bearer | Search past messages |

### Auth

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/sync` | Bearer | Sync Firebase user to DB |

---

## Environment Variables

See [`.env.example`](./.env.example) for all configuration options. Key variables:

| Variable | Purpose |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string |
| `OLLAMA_MODEL` | LLM model for the AI assistant |
| `INFERENCE_SERVICE_URL` | Inference microservice endpoint |
| `FIREBASE_PROJECT_ID` | Firebase Auth project |
| `REDIS_URL` | Redis cache (optional) |
| `ELASTIC_SEARCH_URL` | Elasticsearch (optional) |
