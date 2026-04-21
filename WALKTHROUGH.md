### Step 1 — Find your agent

```
/hamming-agents
```

Lists every voice agent in your Hamming workspace, with its ID. Copy the ID of the agent you want to test.

If your workspace has a large number of agents, the card can be unwieldy to scroll through — it's often faster to grab the agent ID directly from the Hamming.ai dashboard.

### Step 2 — Find what to run against it

Two ways, but prefer tags.

```
/hamming-tags <agentId>
```

Lists every tag attached to that agent, with how many cases each tag contains. Pick the tag you want and copy its ID.

If the agent has no tags yet, create one in Hamming.ai, fill it with the cases you want to run, and attach the agent to it. From then on, running tests in Slack is one command.

Only use `/hamming-datasets` if you genuinely want to run a single case — tags are less typing and less error-prone.

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
