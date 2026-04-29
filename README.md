# 🔨 Hamming.ai Slack Bot

A Slack bot that brings Hamming.ai's voice agent testing into Slack. Trigger outbound and inbound test runs, poll status, and view scored results (guardrails, latency, top issues) without leaving the channel.

---

## Commands

Each selection token in a run command is either a `testCaseId` or `tag:<tagId>` (a tag runs every case attached to it). Comma-separate multiple tokens with **no spaces**.

| Command | Description |
|---|---|
| `/hamming-help` | Show all available commands with usage and examples |
| `/hamming-run-outbound <agentId> <selection[,selection,...]> [--samples=N] [--concurrency=N]` | Start an outbound test. Hamming returns temporary numbers your agent must dial before expiry. |
| `/hamming-run-inbound <agentId> <selection[,selection,...]> <phoneNumber[,phoneNumber,...]> [--samples=N] [--concurrency=N]` | Start an inbound test. Hamming dials the phone number(s) attached to your agent. |
| `/hamming-status <testRunId>` | Quick status card: state, timestamps, pass/fail counts |
| `/hamming-results <testRunId>` | Full breakdown: per-case outcome + failed-check reasons, latency metrics, guardrail categories, top issues |
| `/hamming-agents [searchTerm]` | List voice agents in your workspace. Optional search uses **token-AND matching** over name/ID — every word in the query must appear somewhere in the agent's name or ID (any order, punctuation-agnostic). So `mary outbound` matches `Mary: Outbound: Version 35` even though a colon sits between the words. |
| `/hamming-tags` | List **all** workspace tags with per-tag case counts. |
| `/hamming-tags --search=<term>` | List workspace tags whose **name** contains `<term>`. The search value consumes everything after `=` to end of line, so phrases like `--search=agent greeting` work. |
| `/hamming-tags <agentId>` | List only the tags attached to one specific agent. |
| `/hamming-datasets` | List test cases, with the workspace total count. |
| `/hamming-datasets <agentId>` | List only the cases associated with that agent. |
| `/hamming-datasets --search=<term>` | Search test cases by **name** (server-side search then client-side name filter; multi-word phrases supported). |
| `/hamming-datasets <agentId> --search=<term>` | Combine agent filter with name search. |
| `/hamming-tag-create <name> [--description=<desc>]` | Create a new workspace tag. Returns the new tag's ID. |
| `/hamming-tag-attach <tagId> <caseId1,caseId2,...>` | Attach a tag to one or more test cases (comma-separated, no spaces). ⚠️ For the tag to actually run against an agent, the cases you attach must belong to that agent (`agentIds`). The simplest path is `/hamming-case-generate <agentId>` first — those cases are auto-associated. |
| `/hamming-case-generate <agentId> [--count=N] [--instructions=<text>]` | Start an async AI job that generates test cases for an agent. Typically 1–5 min. Generated cases are auto-associated with the agent. Returns a job ID. |
| `/hamming-generate-status <jobId> <agentId>` | Poll generation progress. On `COMPLETED` the same command also fetches and previews the generated cases. Both IDs are required — Hamming ties jobs to the agent they were started for. |

**Optional load-test flags**, usable on either run command:
- `--samples=N` — run each case N times (1–50)
- `--concurrency=N` — cap simultaneous calls (1–100, default 10)

Total runs = `selections × samples × phoneNumbers`.

---

## Setup

### 1. Prerequisites

- Node.js 18+
- A [Hamming.ai](https://app.hamming.ai) account with an API key
- A Slack workspace where you can install apps

---

### 2. Create the Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** → **From Scratch**.
2. Name it `Hamming Bot` and select your workspace.

#### Enable Socket Mode (recommended for local/dev)
- Go to **Socket Mode** in the left sidebar → Toggle it **On**.
- Create an **App-Level Token** with `connections:write` scope. Copy it — this is your `SLACK_APP_TOKEN`.

#### Add Bot Scopes
Go to **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**, and add:
- `commands`
- `chat:write`
- `chat:write.public`

#### Register Slash Commands
Go to **Slash Commands** → **Create New Command** for each of the following:

| Command | Description |
|---|---|
| `/hamming-help` | Show help |
| `/hamming-run-outbound` | Start an outbound voice test |
| `/hamming-run-inbound` | Start an inbound voice test |
| `/hamming-status` | Check test run status |
| `/hamming-results` | Get detailed test run results |
| `/hamming-agents` | List voice agents |
| `/hamming-tags` | List tags attached to an agent |
| `/hamming-datasets` | List test cases |
| `/hamming-tag-create` | Create a new workspace tag |
| `/hamming-tag-attach` | Attach a tag to one or more test cases |
| `/hamming-case-generate` | Start an AI test-case generation job for an agent |
| `/hamming-generate-status` | Poll a generation job (auto-fetches results on completion) |

> **Socket Mode tip:** In Socket Mode, the Request URL fields are not used — leave them blank or use a placeholder like `https://example.com`.

#### Install the App
Go to **Install App** → **Install to Workspace**. Copy the **Bot User OAuth Token** — this is your `SLACK_BOT_TOKEN`.

---

### 3. Get Your Keys

**Slack:**
- `SLACK_BOT_TOKEN` → OAuth & Permissions → Bot User OAuth Token
- `SLACK_SIGNING_SECRET` → Basic Information → App Credentials → Signing Secret
- `SLACK_APP_TOKEN` → Basic Information → App-Level Tokens (Socket Mode only)

**Hamming:**
- `HAMMING_API_KEY` → [https://app.hamming.ai/settings](https://app.hamming.ai/settings) → Create new secret key

---

### 4. Install & Run

```bash
# Clone / unzip the project
cd hamming-slack-bot

# Install dependencies
npm install

# Copy and fill in your credentials
cp .env.example .env
# Edit .env with your actual keys

# Start the bot
npm start

# Or for development with auto-reload:
npm run dev
```

You should see:
```
⚡️ Hamming Slack Bot is running on port 3000
```

---

### 5. Deploy to Production

For a persistent deployment, you can use any Node.js host. Two simple options:

**Railway (easiest):**
```bash
# Install Railway CLI
npm i -g @railway/cli
railway login
railway init
railway up
# Then set environment variables in the Railway dashboard
```

**Render:**
- Connect your GitHub repo, set it as a Web Service, add environment variables, and deploy.

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
CMD ["node", "src/index.js"]
```

---

## Usage Examples

```
# List all the agents you have access to (with total count)
/hamming-agents

# Search agents with token-AND matching (every word must appear somewhere
# in the name/ID, punctuation-agnostic)
/hamming-agents mary outbound
/hamming-agents mary ahmad     # even more specific — both words required

# List every tag in the workspace, with case counts
/hamming-tags

# Search workspace tags by name (multi-word phrases supported)
/hamming-tags --search=agent greeting

# List the tags attached to one specific agent
/hamming-tags cmo1ws1vc2gwv0tbnrug12dwm

# Browse test cases (shows workspace total)
/hamming-datasets

# List only the cases associated with one agent
/hamming-datasets cmo1ws1vc2gwv0tbnrug12dwm

# Search test cases by name
/hamming-datasets --search=appointment confirmation

# Agent filter and name search combined
/hamming-datasets cmo1ws1vc2gwv0tbnrug12dwm --search=appointment confirmation

# Create a new tag, then attach cases to it
/hamming-tag-create smoke-tests --description=Quick sanity checks
/hamming-tag-attach <tagIdFromAbove> caseId1,caseId2,caseId3

# AI-generate new test cases for an agent
/hamming-case-generate cmo1ws1vc2gwv0tbnrug12dwm --count=5 --instructions=focus on appointment escalation paths

# Poll the generation job (1-5 min); the same command auto-fetches results on completion
/hamming-generate-status <jobIdFromAbove> cmo1ws1vc2gwv0tbnrug12dwm

# Outbound: Hamming returns temporary number(s) your agent must dial before expiry
/hamming-run-outbound cmo1ws1vc2gwv0tbnrug12dwm cmo1x8fg61lhu0tdh3p1d1gsn

# Outbound using a tag — runs every case attached to that tag in one shot
/hamming-run-outbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmguyd80z0fokgc1c859g08q7

# Inbound: Hamming dials the phone number attached to your agent
/hamming-run-inbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmguyd80z0fokgc1c859g08q7 +18154291152

# Load test: run each case 10 times with 25 concurrent calls
/hamming-run-outbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmguyd80z0fokgc1c859g08q7 --samples=10 --concurrency=25

# Check status / pull results
/hamming-status cmo367rl908xi0tg9jp7e8e0u
/hamming-results cmo367rl908xi0tg9jp7e8e0u
```

---

## Project Structure

```
hamming-slack-bot/
├── src/
│   ├── index.js       # Slack app, command handlers, action handlers
│   ├── hamming.js     # Hamming REST API client
│   └── formatters.js  # Block Kit message formatters
├── .env.example       # Environment variable template
├── package.json
└── README.md
```

---

## Notes on Hamming API

The bot uses Hamming's public REST API (`https://app.hamming.ai/api/rest`). Endpoints wired up:

- `POST /test-runs/test-outbound-agent` — Start an outbound test; response includes `testRunId`, `expiresAt`, and `assignedNumbers` your agent must dial before expiry
- `POST /test-runs/test-inbound-agent` — Start an inbound test; Hamming dials the `phoneNumbers` you provide
- `GET /test-runs/{id}/status` — Poll status (QUEUED / RUNNING / COMPLETED / FAILED)
- `GET /test-runs/{id}/results` — Fetch full results including per-case `assertionResults` with failure reasons, `summary.metrics` (latency percentiles, TTFW, talk ratio, etc.), `summary.assertions.categories` (guardrail breakdown), and `summary.topIssues`
- `GET /agents` — List voice agents (no server-side search; filtering happens client-side)
- `GET /agents/{id}/test-tags` — List tags attached to a specific agent with a `testCaseCount` per tag
- `GET /test-tags` — List workspace-wide tags. Used by `/hamming-tags` (no agentId) and `--search=<term>` mode. Name filtering happens client-side so description matches don't dilute results.
- `POST /test-tags` — Create a workspace tag. Body: `{ name, description? }`. Used by `/hamming-tag-create`.
- `POST /test-tags/{tagId}/test-cases` — Attach a tag to one or more test cases. Body: `{ testCaseIds: [...] }`. Used by `/hamming-tag-attach`.
- `POST /test-cases/generate` — Start an async AI generation job. Body: `{ customerVoiceAgentId, maxTestCases?, generationInstructions? }`. Returns a job ID. Used by `/hamming-case-generate`.
- `GET /test-cases/generate/{jobId}/status?customerVoiceAgentId=...` — Poll job status. Returns `PENDING` / `IN_PROGRESS` / `COMPLETED` / `FAILED` and a `currentStep` counter during `IN_PROGRESS`.
- `GET /test-cases/generate/{jobId}/result?customerVoiceAgentId=...` — Fetch generated cases once `COMPLETED` (returns 400 otherwise). Used by `/hamming-generate-status` after it sees `COMPLETED`.
- `GET /test-cases` — List test cases (supports `search`, `limit` max 500, `offset`, plus `total` in response). Used by `/hamming-datasets` — server search narrows the candidate set, then a client-side name filter strips description matches, same rationale as `/test-tags`.

Both run endpoints accept `testConfigurations[]` where each item selects by either `testCaseId` or `tagId`. Optional load-test parameters are `samplingCount` (1–50) and `maxConcurrentCalls` (1–100, default 10).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `HAMMING_API_KEY is not set` | Check your `.env` file |
| `Hamming API error (401)` | Your API key is wrong or expired — regenerate at hamming.ai/settings |
| `Hamming API error (404)` | The `agentId`, `testCaseId`, `tagId`, or `testRunId` doesn't exist |
| `Hamming API error (400): Requested run selection resolved to no runnable test cases` | The tag (or specific cases) you're running aren't associated with the target agent. Test cases have an `agentIds` field; runs only resolve cases whose `agentIds` includes the agent in your run command. **Easiest fix:** use `/hamming-case-generate <agentId>` — generated cases are auto-associated with the agent. Otherwise verify the cases belong to your agent first via `/hamming-datasets <agentId>` before attaching them to the tag. |
| Outbound test completes after 60 min with no calls placed | Your agent never dialed the `assignedNumbers` before they expired (~10 min). The "Test Run Started!" card lists the numbers and expiry — your agent has to place those calls. |
| Slash commands not appearing | Make sure all commands are registered in api.slack.com and the app is reinstalled |
| Each slash command appears twice in autocomplete | Check **Slash Commands** in api.slack.com for duplicate entries, and check that only one copy of the app is installed in your workspace |
| `dispatch_failed` in Slack | The bot server isn't running — check the terminal where `npm start` was launched |
