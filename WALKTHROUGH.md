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

## Common first-run gotchas

- Outbound run "completed" after an hour with zero calls — your agent didn't dial the assigned numbers within the 10-minute window. That's on your agent, not Hamming.
- `Hamming API error (404)` — one of your IDs (agent, case, tag, or run) is wrong. Re-verify with `/hamming-agents` or `/hamming-tags`.
- Spaces in a comma list — `tag:abc, tag:def` breaks the parser. Use `tag:abc,tag:def` with no spaces.
- `dispatch_failed` in Slack — the bot server isn't running.
