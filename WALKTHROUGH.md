### Step 0 — Quickstart

The whole end-to-end flow, with each step expanded in the sections below:

```
/hamming-agents blah blah                     → find the agent
/hamming-tag-create <name>                    → new tag
/hamming-case-generate <agentId>              → AI generates cases (auto-associated)
/hamming-datasets <agentId>                   → find the new case IDs
/hamming-tag-attach <tagId> <caseIds>         → group them under the tag
/hamming-run-outbound <agentId> tag:<tagId>   → outbound: Hamming returns numbers your agent must dial
/hamming-run-inbound <agentId> tag:<tagId> <+1phoneNumber>   → inbound: Hamming dials the number
```

If you already know the commands, that's it. The rest of this doc expands each step.

### Step 1 — Find your agent

```
/hamming-agents
```

Lists every voice agent in your Hamming workspace, with its ID. The header shows the total count so you know how big the list actually is.

If your workspace has thousands of agents, narrow the list with an optional search term. Matching is **token-AND** — every word in your query must appear somewhere in the agent's name or ID, in any order, regardless of punctuation between them:

```
/hamming-agents mary outbound     # matches "Mary: Outbound: Version 35"
/hamming-agents mary ahmad        # both words required, any order
```

For very large workspaces the card is still capped at 45 rows, so search is the main way to find the exact one you want.

### Step 2 — Find what to run against it

Three ways to list tags, in order of typical usefulness:

```
/hamming-tags --search=<term>
```

Workspace-wide tag search on tag **name** (case-insensitive substring, multi-word phrases supported). Best for finding a specific tag in a big workspace: `/hamming-tags --search=agent greeting`.

```
/hamming-tags
```

All workspace tags, no filter. Good for first-time browsing to see what's available.

```
/hamming-tags <agentId>
```

Only the tags attached to one specific agent. Useful once you already know the agent.

Prefer tags over single cases. If you do need a single case ID:

- `/hamming-datasets` — browse all cases (shows workspace total)
- `/hamming-datasets <agentId>` — only the cases associated with one agent
- `/hamming-datasets --search=<term>` — search by name (multi-word phrases supported)
- `/hamming-datasets <agentId> --search=<term>` — both filters combined

If the agent has no tags yet, create one in Hamming.ai, fill it with the cases you want to run, and attach the agent to it. From then on, running tests in Slack is one command.

### Step 3 — Start the test

Outbound:

```
/hamming-run-outbound <agentId> tag:<tagId>
```

Inbound (also takes a phone number for Hamming to dial):

```
/hamming-run-inbound <agentId> tag:<tagId> <phoneNumber>
```

The selection argument accepts tags, individual test case IDs, or a comma-separated mix — no spaces between items.

```
/hamming-run-outbound <agentId> caseId1,caseId2,tag:tagId3
```

The response card gives you:

- A Test Run ID — save this.
- For outbound: one or more temporary numbers and a "dial before" expiry. Your agent must place those calls before the expiry or the run dies.
- A Check Status button.

### Step 4 — Watch it

```
/hamming-status <testRunId>
```

Status card: `QUEUED` → `RUNNING` → `COMPLETED`, with pass/fail counts and a refresh button so you don't have to re-type the ID.

### Step 5 — Read the scored results

Once the run is `COMPLETED`:

```
/hamming-results <testRunId>
```

The card shows:

- Summary — pass rate, failed count, errored count, guardrails score, infra score
- Per-case breakdown (first 5 cases) with failed assertions and the reason strings Hamming returned
- Latency metrics — P50 / P90 / P95, time-to-first-word, stop latency, talk ratio, interruptions
- Guardrails — per-category pass/fail (stayed on topic, no hallucination, etc.)
- Top issues — Hamming's auto-generated issue list with severity and a recommendation

---

## Load testing

Both run commands accept two optional flags:

- `--samples=N` — run each case N times (1–50)
- `--concurrency=N` — cap parallel calls (1–100, default 10)

```
/hamming-run-outbound <agentId> tag:<tagId> --samples=10 --concurrency=25
```

Total calls placed = selections × samples × phoneNumbers.

---

## Creating tags from Slack

You don't need to open the Hamming dashboard to organize test cases into a tag.

```
/hamming-tag-create <name> [--description=<desc>]
```

Creates a workspace tag. The response includes the new tag's ID.

```
/hamming-tag-attach <tagId> <caseId1,caseId2,...>
```

Attaches the tag to one or more existing test cases (comma-separated, no spaces). Once attached, `/hamming-run-outbound <agentId> tag:<tagId>` will run every case under that tag.

Typical flow:

1. `/hamming-datasets <agentId> --search=<topic>` — find cases you want to group
2. `/hamming-tag-create <name>` — create the tag
3. `/hamming-tag-attach <tagId> <caseIds>` — attach the cases from step 1
4. `/hamming-run-outbound <agentId> tag:<tagId>` — run them

---

## Generating test cases from Slack

For agents that don't have enough coverage yet, you can ask Hamming's AI to generate fresh cases without touching the dashboard.

```
/hamming-case-generate <agentId> [--count=N] [--instructions=<free text>]
```

Starts an async job. Responds with a job ID and the exact status command to run. `--instructions=` consumes everything to end of line, so natural phrases work: `--instructions=focus on appointment escalation paths`.

```
/hamming-generate-status <jobId> <agentId>
```

Polls the job. Expect 1–5 minutes of `PENDING` / `IN_PROGRESS` before it flips to `COMPLETED`. When it's done, the same command auto-fetches the results and previews the generated cases (name + ID, first 10).

The generated cases are auto-associated with the agent — run `/hamming-datasets <agentId>` to see all the cases that now belong to it. From there you can group them into a tag with the flow above if you want to batch-run them.

On failure, the status response surfaces Hamming's error message — usually enough to diagnose (bad agent config, instructions too long, etc.).

---

## Common first-run gotchas

- Outbound run "completed" after an hour with zero calls — your agent didn't dial the assigned numbers within the 10-minute window. That's on your agent, not Hamming.
- `Hamming API error (404)` — one of your IDs (agent, case, tag, or run) is wrong. Re-verify with `/hamming-agents` or `/hamming-tags`.
- Spaces in a comma list — `tag:abc, tag:def` breaks the parser. Use `tag:abc,tag:def` with no spaces.
- `dispatch_failed` in Slack — the bot server isn't running.
