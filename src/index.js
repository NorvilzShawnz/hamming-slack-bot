const { App } = require("@slack/bolt");
require("dotenv").config();

const hammingClient = require("./hamming");
const {
  formatTestRunStatus,
  formatTestRunResults,
  formatTestCases,
  formatAgents,
  formatAgentTags,
  formatWorkspaceTags,
} = require("./formatters");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: process.env.SLACK_APP_TOKEN ? true : false,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000,
});

function parseTestConfigurations(arg) {
  const tokens = arg.split(",").map((s) => s.trim()).filter(Boolean);
  const configurations = tokens.map((t) =>
    t.toLowerCase().startsWith("tag:") ? { tagId: t.slice(4).trim() } : { testCaseId: t }
  );
  const tagCount = configurations.filter((c) => c.tagId).length;
  const caseCount = configurations.length - tagCount;
  return { configurations, tagCount, caseCount };
}

function extractFlags(parts) {
  const flags = {};
  const remaining = [];
  for (const p of parts) {
    const m = /^--([a-zA-Z]+)=(.+)$/.exec(p);
    if (m) flags[m[1].toLowerCase()] = m[2];
    else remaining.push(p);
  }
  return { remaining, flags };
}

function parseLoadOptions(flags) {
  const opts = {};
  const errors = [];
  if (flags.samples != null) {
    const n = parseInt(flags.samples, 10);
    if (!Number.isFinite(n) || n < 1 || n > 50) errors.push("`--samples=N` must be an integer 1–50");
    else opts.samplingCount = n;
  }
  if (flags.concurrency != null) {
    const n = parseInt(flags.concurrency, 10);
    if (!Number.isFinite(n) || n < 1 || n > 100) errors.push("`--concurrency=N` must be an integer 1–100");
    else opts.maxConcurrentCalls = n;
  }
  return { opts, errors };
}

app.command("/hamming-help", async ({ ack, respond }) => {
  await ack();
  await respond({
    response_type: "ephemeral",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🔨 Hamming.ai Slack Bot — Commands" } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*🧪 Run a test*\n" +
            "Each selection token is either a `testCaseId` or `tag:<tagId>` (a tag runs every case it's attached to).\n\n" +
            "`/hamming-run-outbound <agentId> <selection[,selection,...]>`\n" +
            "↳ Outbound: Hamming returns temporary numbers _your agent dials_.\n" +
            "  _Single case:_ `/hamming-run-outbound cmo1ws1vc2gwv0tbnrug12dwm cmo1x8fg61lhu0tdh3p1d1gsn`\n" +
            "  _Whole tag:_  `/hamming-run-outbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmo1ww6ny1g1g0tdh58cp0lbi`\n" +
            "  _Mixed:_      `/hamming-run-outbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmo1ww6ny1g1g0tdh58cp0lbi,cmo1x8fg61lhu0tdh3p1d1gsn`\n\n" +
            "`/hamming-run-inbound <agentId> <selection[,selection,...]> <phoneNumber[,phoneNumber,...]>`\n" +
            "↳ Inbound: Hamming dials the phone number(s) attached to your agent.\n" +
            "  _Example:_ `/hamming-run-inbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmo1ww6ny1g1g0tdh58cp0lbi +18154291152`\n\n" +
            "⚠️ _Comma-separated lists must have **no spaces** between items._\n\n" +
            "*⚡ Load-test flags* (optional, work on both run commands):\n" +
            "• `--samples=N` — run each case N times (1–50)\n" +
            "• `--concurrency=N` — cap simultaneous calls (1–100, default 10)\n" +
            "  _Example:_ `/hamming-run-inbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmo1ww6ny1g1g0tdh58cp0lbi +18154291152 --samples=10 --concurrency=25`\n" +
            "  _Total runs = cases × samples × phone numbers._",
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*📊 Check a test*\n" +
            "`/hamming-status <testRunId>` — Quick status + pass/fail counts.\n" +
            "  _Example:_ `/hamming-status cmo367rl908xi0tg9jp7e8e0u`\n\n" +
            "`/hamming-results <testRunId>` — Full breakdown: guardrails, latency metrics, failed-check reasons, top issues.\n" +
            "  _Example:_ `/hamming-results cmo367rl908xi0tg9jp7e8e0u`",
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*📚 Find IDs*\n" +
            "`/hamming-agents [searchTerm]` — List your voice agents. Optional search filters by name/ID.\n" +
            "  _Example:_ `/hamming-agents mary`  →  only agents whose name contains \"mary\"\n\n" +
            "`/hamming-tags` — List *all* workspace tags with case counts (doesn't need an agent ID).\n" +
            "`/hamming-tags --search=<term>` — Search workspace tags.\n" +
            "`/hamming-tags <agentId>` — List only the tags attached to one agent.\n" +
            "  _Example:_ `/hamming-tags cmo1ws1vc2gwv0tbnrug12dwm`\n\n" +
            "`/hamming-datasets` — List all test cases (shows workspace total).\n" +
            "`/hamming-datasets <agentId>` — List only cases associated with that agent.\n" +
            "`/hamming-datasets --search=<term>` — Search test cases by name (multi-word phrases supported). The `<agentId>` and `--search=` can combine.\n" +
            "  _Example:_ `/hamming-datasets cmo1ws1vc2gwv0tbnrug12dwm --search=appointment confirmation`\n\n" +
            "*✏️ Create & organize*\n" +
            "`/hamming-tag-create <name> [--description=<desc>]` — Create a new workspace tag.\n" +
            "  _Example:_ `/hamming-tag-create appointment confirmation --description=Agent confirms time`\n\n" +
            "`/hamming-tag-attach <tagId> <caseId1,caseId2,...>` — Attach a tag to one or more test cases.\n" +
            "  _Example:_ `/hamming-tag-attach cmo1ww6ny1g1g0tdh58cp0lbi caseA,caseB,caseC`\n\n" +
            "`/hamming-help` — Show this help.",
        },
      },
      { type: "context", elements: [{ type: "mrkdwn", text: "🔗 Docs: <https://docs.hamming.ai|docs.hamming.ai>" }] },
    ],
  });
});

app.command("/hamming-run-outbound", async ({ command, ack, respond }) => {
  await ack();
  const rawParts = command.text.trim().split(/\s+/).filter(Boolean);
  const { remaining: parts, flags } = extractFlags(rawParts);
  if (parts.length < 2) {
    return respond({
      response_type: "ephemeral",
      text:
        "⚠️ Usage: `/hamming-run-outbound <agentId> <testCaseId|tag:tagId>[,...] [--samples=N] [--concurrency=N]`\n" +
        "Example: `/hamming-run-outbound cmo1mx5kk5k9c0tkm465ibna3 tag:cmo1ww6ny1g1g0tdh58cp0lbi --samples=5`",
    });
  }

  const [agentId, testCaseArg] = parts;
  const { configurations, tagCount, caseCount } = parseTestConfigurations(testCaseArg);
  const { opts, errors } = parseLoadOptions(flags);

  if (configurations.length === 0) {
    return respond({
      response_type: "ephemeral",
      text: "⚠️ At least one `testCaseId` or `tag:<tagId>` is required.",
    });
  }
  if (errors.length) {
    return respond({ response_type: "ephemeral", text: `⚠️ ${errors.join(" · ")}` });
  }

  try {
    const result = await hammingClient.startOutboundTestRun(agentId, configurations, opts);
    const testRunId = result.id || result.testRunId || result.test_run_id;
    const assignedNumbers = result.assignedNumbers || [];
    const expiresAt = result.expiresAt;

    const numberLines = assignedNumbers.length
      ? assignedNumbers
          .map((a) => {
            const num = a.phoneNumber || a.number || a;
            const tc = a.testCaseId ? ` _(${a.testCaseId})_` : "";
            return `  • \`${num}\`${tc}`;
          })
          .join("\n")
      : "  _(none returned — check dashboard)_";

    const expiresLine = expiresAt
      ? `⏰ *Dial before:* ${new Date(expiresAt).toLocaleString()}`
      : "⏰ _Assignments typically expire in ~10 minutes_";

    await respond({
      response_type: "in_channel",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `✅ *Outbound Test Run Started!*\n` +
              `• Test Run ID: \`${testRunId || "see dashboard"}\`\n` +
              `• Agent: \`${agentId}\`\n` +
              `• Selections: ${caseCount} case(s)` + (tagCount ? ` + ${tagCount} tag(s)` : "") + `\n` +
              (opts.samplingCount || opts.maxConcurrentCalls
                ? `• Load: ` +
                  [
                    opts.samplingCount ? `${opts.samplingCount} sample(s)/case` : null,
                    opts.maxConcurrentCalls ? `${opts.maxConcurrentCalls} concurrent` : null,
                  ].filter(Boolean).join(" · ") + `\n`
                : "") +
              `\n` +
              `📞 *Your agent must call these numbers:*\n${numberLines}\n\n` +
              `${expiresLine}\n\n` +
              (testRunId ? `_Use \`/hamming-status ${testRunId}\` to check progress._` : ""),
          },
        },
        ...(testRunId
          ? [
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "Check Status" },
                    action_id: "check_status",
                    value: testRunId,
                    style: "primary",
                  },
                ],
              },
            ]
          : []),
      ],
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.command("/hamming-run-inbound", async ({ command, ack, respond }) => {
  await ack();
  const rawParts = command.text.trim().split(/\s+/).filter(Boolean);
  const { remaining: parts, flags } = extractFlags(rawParts);
  if (parts.length < 3) {
    return respond({
      response_type: "ephemeral",
      text:
        "⚠️ Usage: `/hamming-run-inbound <agentId> <testCaseId|tag:tagId>[,...] <phoneNumber>[,<phoneNumber>,...] [--samples=N] [--concurrency=N]`\n" +
        "Example: `/hamming-run-inbound cmo1ws1vc2gwv0tbnrug12dwm tag:cmo1ww6ny1g1g0tdh58cp0lbi +15551234567 --samples=5`",
    });
  }

  const [agentId, testCaseArg, phoneArg] = parts;
  const { configurations, tagCount, caseCount } = parseTestConfigurations(testCaseArg);
  const phoneNumbers = phoneArg.split(",").map((s) => s.trim()).filter(Boolean);
  const { opts, errors } = parseLoadOptions(flags);

  if (configurations.length === 0) {
    return respond({ response_type: "ephemeral", text: "⚠️ At least one `testCaseId` or `tag:<tagId>` is required." });
  }
  if (phoneNumbers.length === 0) {
    return respond({ response_type: "ephemeral", text: "⚠️ At least one `phoneNumber` is required." });
  }
  if (errors.length) {
    return respond({ response_type: "ephemeral", text: `⚠️ ${errors.join(" · ")}` });
  }

  try {
    const result = await hammingClient.startInboundTestRun(agentId, configurations, phoneNumbers, opts);
    const testRunId = result.id || result.testRunId || result.test_run_id;
    await respond({
      response_type: "in_channel",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `✅ *Inbound Test Run Started!*\n` +
              `• Test Run ID: \`${testRunId || "see dashboard"}\`\n` +
              `• Agent: \`${agentId}\`\n` +
              `• Dialing: ${phoneNumbers.join(", ")}\n` +
              `• Selections: ${caseCount} case(s)` + (tagCount ? ` + ${tagCount} tag(s)` : "") + `\n` +
              (opts.samplingCount || opts.maxConcurrentCalls
                ? `• Load: ` +
                  [
                    opts.samplingCount ? `${opts.samplingCount} sample(s)/case` : null,
                    opts.maxConcurrentCalls ? `${opts.maxConcurrentCalls} concurrent` : null,
                  ].filter(Boolean).join(" · ") + `\n`
                : "") +
              `\n` +
              (testRunId ? `_Use \`/hamming-status ${testRunId}\` to check progress._` : ""),
          },
        },
        ...(testRunId
          ? [
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "Check Status" },
                    action_id: "check_status",
                    value: testRunId,
                    style: "primary",
                  },
                ],
              },
            ]
          : []),
      ],
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.command("/hamming-status", async ({ command, ack, respond }) => {
  await ack();
  const testRunId = command.text.trim();
  if (!testRunId) {
    return respond({ response_type: "ephemeral", text: "⚠️ Usage: `/hamming-status <testRunId>`" });
  }

  try {
    const status = await hammingClient.getTestRunStatus(testRunId);
    await respond({
      response_type: "in_channel",
      blocks: formatTestRunStatus(status, testRunId),
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.command("/hamming-results", async ({ command, ack, respond }) => {
  await ack();
  const testRunId = command.text.trim();
  if (!testRunId) {
    return respond({ response_type: "ephemeral", text: "⚠️ Usage: `/hamming-results <testRunId>`" });
  }

  await respond({
    response_type: "ephemeral",
    text: `⏳ Fetching results for test run \`${testRunId}\`...`,
  });

  try {
    const results = await hammingClient.getTestRunResults(testRunId);
    await respond({
      response_type: "in_channel",
      blocks: formatTestRunResults(results, testRunId),
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.command("/hamming-datasets", async ({ command, ack, respond }) => {
  await ack();
  const rawText = (command.text || "").trim();
  let searchTerm = "";
  let beforeSearch = rawText;
  const searchIdx = rawText.toLowerCase().indexOf("--search=");
  if (searchIdx !== -1) {
    searchTerm = rawText.slice(searchIdx + "--search=".length).trim();
    beforeSearch = rawText.slice(0, searchIdx).trim();
  }
  const parts = beforeSearch.split(/\s+/).filter(Boolean);
  const agentId = parts[0];

  try {
    const data = await hammingClient.listTestCases({
      search: searchTerm || undefined,
      agentId: agentId || undefined,
      limit: 500,
    });
    const items = data.testCases || data.test_cases || data.items || (Array.isArray(data) ? data : []) || [];
    const total = data.total;
    await respond({
      response_type: "ephemeral",
      blocks: formatTestCases(items, { searchTerm, total, agentId }),
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.command("/hamming-agents", async ({ command, ack, respond }) => {
  await ack();
  const searchQuery = (command.text || "").trim();
  try {
    const data = await hammingClient.listAgents();
    await respond({
      response_type: "ephemeral",
      blocks: formatAgents(data.agents || [], searchQuery),
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.command("/hamming-tags", async ({ command, ack, respond }) => {
  await ack();
  const rawText = (command.text || "").trim();
  let searchTerm = "";
  let beforeSearch = rawText;
  const searchIdx = rawText.toLowerCase().indexOf("--search=");
  if (searchIdx !== -1) {
    searchTerm = rawText.slice(searchIdx + "--search=".length).trim();
    beforeSearch = rawText.slice(0, searchIdx).trim();
  }
  const parts = beforeSearch.split(/\s+/).filter(Boolean);
  const agentId = parts[0];

  try {
    if (agentId && !searchTerm) {
      const data = await hammingClient.listAgentTags(agentId);
      return respond({
        response_type: "ephemeral",
        blocks: formatAgentTags(data.tags || [], agentId),
      });
    }

    const data = await hammingClient.listWorkspaceTags({ agentId });
    return respond({
      response_type: "ephemeral",
      blocks: formatWorkspaceTags(data.tags || [], { searchTerm: searchTerm || "" }),
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.command("/hamming-tag-create", async ({ command, ack, respond }) => {
  await ack();
  const rawText = (command.text || "").trim();

  let description = "";
  let beforeDesc = rawText;
  const descIdx = rawText.toLowerCase().indexOf("--description=");
  if (descIdx !== -1) {
    description = rawText.slice(descIdx + "--description=".length).trim();
    beforeDesc = rawText.slice(0, descIdx).trim();
  }
  const name = beforeDesc;

  if (!name) {
    return respond({
      response_type: "ephemeral",
      text:
        "⚠️ Usage: `/hamming-tag-create <name> [--description=<desc>]`\n" +
        "Example: `/hamming-tag-create appointment confirmation --description=Agent confirms appointment time`",
    });
  }

  try {
    const tag = await hammingClient.createTag({ name, description: description || undefined });
    const tagId = tag.id || tag.tagId;
    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `✅ *Tag created!*\n` +
              `• Name: *${name}*\n` +
              (description ? `• Description: _${description}_\n` : "") +
              `• ID: \`${tagId || "(see dashboard)"}\`` +
              (tagId
                ? `\n\n_Attach cases with:_ \`/hamming-tag-attach ${tagId} <caseId1,caseId2,...>\``
                : ""),
          },
        },
      ],
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.command("/hamming-tag-attach", async ({ command, ack, respond }) => {
  await ack();
  const parts = (command.text || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return respond({
      response_type: "ephemeral",
      text:
        "⚠️ Usage: `/hamming-tag-attach <tagId> <caseId1,caseId2,...>`\n" +
        "Example: `/hamming-tag-attach cmo1ww6ny1g1g0tdh58cp0lbi caseA,caseB,caseC`\n" +
        "_(Comma-separated case IDs, no spaces.)_",
    });
  }
  const [tagId, caseArg] = parts;
  const caseIds = caseArg.split(",").map((s) => s.trim()).filter(Boolean);
  if (caseIds.length === 0) {
    return respond({
      response_type: "ephemeral",
      text: "⚠️ At least one `testCaseId` is required. Separate multiple with commas (no spaces).",
    });
  }

  try {
    await hammingClient.attachTagToCases(tagId, caseIds);
    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `✅ *Tag attached!*\n` +
              `• Tag: \`${tagId}\`\n` +
              `• Cases attached: ${caseIds.length}\n\n` +
              `_Run the tag with:_ \`/hamming-run-outbound <agentId> tag:${tagId}\``,
          },
        },
      ],
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `❌ Error: ${err.message}` });
  }
});

app.action("check_status", async ({ body, ack, respond }) => {
  await ack();
  const testRunId = body.actions[0].value;
  try {
    const status = await hammingClient.getTestRunStatus(testRunId);
    await respond({
      replace_original: false,
      blocks: formatTestRunStatus(status, testRunId),
    });
  } catch (err) {
    await respond({ replace_original: false, text: `❌ Error fetching status: ${err.message}` });
  }
});

(async () => {
  await app.start();
  console.log(`⚡️ Hamming Slack Bot is running on port ${process.env.PORT || 3000}`);
})();
