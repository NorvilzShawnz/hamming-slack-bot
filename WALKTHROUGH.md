### Step 1 — Find your agent

```
/hamming-agents
```

You get a card listing every voice agent in your Hamming workspace, with its ID. Copy the ID of the agent you want to test.
**If your workspace has a large number of voice agents, `/hamming-agents` can be unwieldy to scroll through — it's often faster to grab the agent ID directly from the Hamming.ai dashboard.**

([index.js:347](src/index.js#L347) handles this → calls `listAgents()` → formatted by `formatAgents()` at [formatters.js:273](src/formatters.js#L273).)

### Step 2 — Find what to run against it

Two ways, but **strongly prefer tags**:

```
/hamming-tags cmo1ws1vc2gwv0tbnrug12dwm
```

This lists every tag attached to that agent, with how many cases each tag contains. Pick the tag you want, copy its ID.
**If your agent does not have any Tags assigned to it this will not return any. So you should create a tag (In Hamming.Ai, yes sorry again) fill it up with the test cases you want to run and then attach the Agent to it. The command will then return the tags that the agent is attached to in slack and from then on you can multi-queue tests over and over again.**

Only use `/hamming-datasets` (which lists individual test cases) if you genuinely want to run a single case — tags are less typing and less error-prone.

### Step 3 — Start the test

For outbound:


```
/hamming-run-outbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmo1ww6ny1g1g0tdh58cp0lbi
```
```
/hamming-run-outbound <agentId> <testCaseId|tagId>
```
**You can use a singular test case or a multiple amount delimited by commas instead of using a tag. i.e: cmo8o9y1b15je0tcetypo96bg,cmo8o324b15je0tcetypo96bg,cmfsao9a2415je0tcetypo96bg,cmzxc9y1b15je0tcetypo96bg.**

The response card gives you:
- A **Test Run ID** — save this.
- A **"Dial before" expiry** and one or more temporary phone numbers — your agent has to call these *before the expiry* or the run dies.
- A **Check Status** button that re-polls for you.

For inbound, you also pass the phone number Hamming should dial:

```
/hamming-run-inbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmo1ww6ny1g1g0tdh58cp0lbi +18154291152
```
**You can use a singular test case or a multiple amount delimited by commas instead of using a tag. i.e: cmo8o9y1b15je0tcetypo96bg,cmo8o324b15je0tcetypo96bg,cmfsao9a2415je0tcetypo96bg,cmzxc9y1b15je0tcetypo96bg.**

### Step 4 — Watch it

```
/hamming-status cmo367rl908xi0tg9jp7e8e0u
```

Quick card: `QUEUED` → `RUNNING` → `COMPLETED`, plus pass/fail counts. There's a 🔁 Refresh button so you can keep re-checking without re-typing the ID.

### Step 5 — Read the scored results

Once it's `COMPLETED`:

```
/hamming-results cmo367rl908xi0tg9jp7e8e0u
```

This is the big one. The card shows:
- **Summary header** — pass rate %, failed count, errored count, guardrails %, infra score.
- **Per-case breakdown** (first 5 cases) — for each failed case, the failed assertions and the *reason* strings Hamming returned.
- **Infrastructure metrics** — P50/P90/P95 latency, time-to-first-word, stop latency, talk ratio, interruption count.
- **Guardrails** — per-category pass/fail (e.g. "Stayed on topic", "No hallucination").
- **Top issues** — Hamming's auto-generated issue list with severity + recommendation.

All of that comes from a single `GET /test-runs/{id}/results` response; the structure is mostly `summary.metrics`, `summary.assertions.categories`, and `summary.topIssues`, which you can see being unpacked in [formatters.js:82](src/formatters.js#L82).

---

## Load testing

Both run commands accept two optional flags:

- `--samples=N` — run each case N times (1–50)
- `--concurrency=N` — cap parallel calls (1–100, default 10)

```
/hamming-run-outbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmo1ww6ny1g1g0tdh58cp0lbi --samples=10 --concurrency=25
```

Total calls placed = `selections × samples × phoneNumbers`. Parsed at [index.js:31](src/index.js#L31), validated at [index.js:42](src/index.js#L42).

---

## Mixing selections

The selection argument is comma-separated *with no spaces*. You can mix tags and individual case IDs freely:

```
/hamming-run-outbound <agentId> tag:abc123,tag:def456,cmo1x8fg61lhu0tdh3p1d1gsn
```

Each token becomes one entry in Hamming's `testConfigurations[]` array — a `{tagId}` if it starts with `tag:`, a `{testCaseId}` otherwise. See the parser at [index.js:21](src/index.js#L21).

---

## Common first-run gotchas

- **Outbound run "completed" after an hour with zero calls.** You forgot to have your agent dial the `assignedNumbers` within the 10-minute window. The "Test Run Started" card shows them — that's your job, not Hamming's.
- **`Hamming API error (404)`** — one of your IDs (agent, case, tag, or run) is wrong. Run `/hamming-agents` or `/hamming-tags` to re-verify.
- **Spaces in a comma list** — `tag:abc, tag:def` will be parsed as two separate arguments and the second one gets interpreted as a phone number. Use `tag:abc,tag:def` with no space.
- **Slash command returns `dispatch_failed`** — the bot server isn't running. Check the terminal where you ran `npm start`.

---

