function statusEmoji(status) {
  const map = {
    FINISHED: "✅",
    COMPLETED: "✅",
    PASSED: "✅",
    SUCCESS: "✅",
    RUNNING: "🔄",
    PENDING: "⏳",
    QUEUED: "⏳",
    FAILED: "❌",
    FAIL: "❌",
    ERROR: "⚠️",
    CANCELLED: "🚫",
  };
  return map[(status || "").toUpperCase()] || "❓";
}

function severityEmoji(sev) {
  return { HIGH: "🔴", MEDIUM: "🟡", LOW: "🔵" }[(sev || "").toUpperCase()] || "⚪";
}

function metricStatusEmoji(s) {
  return { pass: "🟢", passed: "🟢", warn: "🟡", warning: "🟡", fail: "🔴", failed: "🔴" }[(s || "").toLowerCase()] || "⚪";
}

function assertionStatusEmoji(s) {
  return { PASSED: "✅", PASS: "✅", FAILED: "❌", FAIL: "❌", SKIPPED: "⏭️", ERROR: "⚠️" }[(s || "").toUpperCase()] || "❓";
}

function fmtDuration(seconds) {
  if (seconds == null) return null;
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtMetricValue(m) {
  if (m?.value == null) return "—";
  const u = m.unit || "";
  const v = u === "ratio" ? `${Math.round(m.value * 100)}%` : `${Number(m.value.toFixed(2))}${u === "s" ? "s" : u === "/min" ? "/min" : ""}`;
  return v;
}

function divider() {
  return { type: "divider" };
}

function fmtDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toLocaleString();
}

function formatTestRunStatus(status, testRunId) {
  const s = status?.status || status?.state || "UNKNOWN";
  const started = fmtDate(status?.createdAt || status?.startedAt);
  const finished = fmtDate(status?.finishedAt || status?.completedAt);
  const total = status?.totalCount ?? status?.totalCases;
  const passed = status?.passedCount ?? status?.passed;
  const failed = status?.failedCount ?? status?.failed;

  const lines = [
    `${statusEmoji(s)} *Test Run Status*`,
    `• ID: \`${testRunId}\``,
    `• Status: *${s}*`,
  ];
  if (started) lines.push(`• Started: ${started}`);
  if (finished) lines.push(`• Finished: ${finished}`);
  if (total != null) lines.push(`• Cases: ${total}` + (passed != null || failed != null ? ` (✅ ${passed ?? 0} · ❌ ${failed ?? 0})` : ""));

  return [
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "🔁 Refresh" }, action_id: "check_status", value: testRunId },
      ],
    },
  ];
}

function formatTestRunResults(results, testRunId) {
  const cases = results?.results || results?.caseRuns || results?.cases || [];
  const summary = results?.summary || {};
  const topIssues = Array.isArray(summary.topIssues) ? summary.topIssues : [];
  const metrics = summary.metrics || {};
  const assertions = summary.assertions || {};
  const categories = Array.isArray(assertions.categories) ? assertions.categories : [];

  if (cases.length === 0) {
    return [{ type: "section", text: { type: "mrkdwn", text: `_No case runs found for test run \`${testRunId}\`._` } }];
  }

  const stats = summary.stats || {};
  const total = stats.total ?? cases.length;
  const passed = stats.passed ?? cases.filter((c) => /pass|success/i.test(c.status || c.outcome || "")).length;
  const failed = stats.failed ?? cases.filter((c) => /fail/i.test(c.status || c.outcome || "")).length;
  const errored = stats.errored ?? cases.filter((c) => /error/i.test(c.status || c.outcome || "")).length;
  const passPct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const guardrailsPct = assertions.overallScore != null ? Math.round(assertions.overallScore) : null;
  const infraScore = metrics.overallScore != null ? Math.round(metrics.overallScore) : null;

  const caseBlocks = cases.slice(0, 5).flatMap((c) => {
    const runId = c.id || c.caseRunId || "—";
    const title = c.testInfo?.title || c.name || c.testCaseName || c.testCaseId || "(untitled case)";
    const s = c.status || c.outcome || "";
    const dur = fmtDuration(c.durationSeconds);
    const tags = (c.testInfo?.tags || []).map((t) => t.name).filter(Boolean);

    const meta = [];
    if (c.toNumber) meta.push(`📞 ${c.toNumber}`);
    if (dur) meta.push(`⏱ ${dur}`);
    if (tags.length) meta.push(`🏷 ${tags.join(", ")}`);
    if (c.recordingUrl) meta.push(`<${c.recordingUrl}|🎧 Recording>`);

    const failures = (c.assertionResults || []).filter((a) => /fail|error/i.test(a.status || ""));
    const reasonLines = failures.slice(0, 4).map((a) => {
      const reason = (a.reason || "").trim().replace(/\s+/g, " ");
      const shortReason = reason.length > 220 ? reason.slice(0, 217) + "…" : reason;
      return `   ${assertionStatusEmoji(a.status)} *${a.assertionName || a.assertionId}* — ${shortReason || "_no detail_"}`;
    });
    const extra = failures.length > 4 ? `   _…and ${failures.length - 4} more_` : null;

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `${statusEmoji(s)} *${title}*\n` +
            `Status: *${s || "unknown"}*` +
            (meta.length ? `  ·  ${meta.join("  ·  ")}` : "") +
            `\n\`${runId}\``,
        },
      },
    ];

    if (reasonLines.length) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: [`*Failed checks:*`, ...reasonLines, ...(extra ? [extra] : [])].join("\n"),
        },
      });
    }

    return blocks;
  });

  const metricRows = [
    ["P50 latency", metrics.latencyP50],
    ["P90 latency", metrics.latencyP90],
    ["P95 latency", metrics.latencyP95],
    ["Time to first word", metrics.timeToFirstWord],
    ["Stop latency", metrics.stopLatency],
    ["User talk ratio", metrics.userTalkRatio],
    ["User interruptions", metrics.userInterruptions],
    ["Assistant monologue", metrics.assistantMonologueDuration],
  ].filter(([, m]) => m && m.value != null);

  const metricsBlock = metricRows.length
    ? [
        divider(),
        { type: "header", text: { type: "plain_text", text: `📡 Infrastructure${infraScore != null ? ` — ${infraScore}%` : ""}` } },
        {
          type: "section",
          fields: metricRows.map(([label, m]) => ({
            type: "mrkdwn",
            text: `*${label}*\n${metricStatusEmoji(m.status)} ${fmtMetricValue(m)}`,
          })),
        },
      ]
    : [];

  const guardrailsBlock = categories.length
    ? [
        divider(),
        { type: "header", text: { type: "plain_text", text: `🛡 Guardrails${guardrailsPct != null ? ` — ${guardrailsPct}%` : ""}` } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: categories
              .map((cat) => {
                const st = cat.stats || {};
                const bits = [];
                if (st.passed) bits.push(`✅ ${st.passed}`);
                if (st.failed) bits.push(`❌ ${st.failed}`);
                if (st.skipped) bits.push(`⏭️ ${st.skipped}`);
                if (st.pending) bits.push(`⏳ ${st.pending}`);
                return `${assertionStatusEmoji(cat.status)} *${cat.name}* — ${bits.join(" · ") || "no results"}`;
              })
              .join("\n"),
          },
        },
      ]
    : [];

  const issueBlocks = topIssues.length
    ? [
        divider(),
        { type: "header", text: { type: "plain_text", text: "🔎 Top Issues" } },
        ...topIssues.slice(0, 5).map((issue) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `${severityEmoji(issue.severity)} *${issue.title}*  _(${issue.severity || "?"}, ${issue.affectedCallCount || 0} call${issue.affectedCallCount === 1 ? "" : "s"})_\n` +
              (issue.recommendation ? `💡 ${issue.recommendation}` : ""),
          },
        })),
      ]
    : [];

  const summaryFields = [
    { type: "mrkdwn", text: `*Pass Rate*\n${passPct}% (${passed}/${total})` },
    { type: "mrkdwn", text: `*Failed*\n❌ ${failed}` },
    { type: "mrkdwn", text: `*Errored*\n⚠️ ${errored}` },
    { type: "mrkdwn", text: `*Issues*\n💡 ${topIssues.length} found` },
  ];
  if (guardrailsPct != null) summaryFields.push({ type: "mrkdwn", text: `*Guardrails*\n🛡 ${guardrailsPct}%` });
  if (infraScore != null) summaryFields.push({ type: "mrkdwn", text: `*Infra Score*\n📡 ${infraScore}%` });

  return [
    { type: "header", text: { type: "plain_text", text: `📊 Test Run Results` } },
    { type: "section", fields: summaryFields },
    { type: "context", elements: [{ type: "mrkdwn", text: `Run ID: \`${testRunId}\`` }] },
    divider(),
    ...caseBlocks,
    ...(cases.length > 5
      ? [{ type: "context", elements: [{ type: "mrkdwn", text: `_Showing 5 of ${cases.length}. <https://app.hamming.ai|View all in Hamming>_` }] }]
      : []),
    ...metricsBlock,
    ...guardrailsBlock,
    ...issueBlocks,
  ];
}

function formatTestCases(testCases) {
  if (!testCases || testCases.length === 0) {
    return [{ type: "section", text: { type: "mrkdwn", text: "_No test cases found in your workspace._" } }];
  }

  const rows = testCases.slice(0, 45).map((tc) => {
    const tagList = Array.isArray(tc.tags) ? tc.tags : [];
    const tagLine = tagList.length
      ? `\n🏷 ${tagList.map((t) => `${t.name} \`${t.id}\``).join("  ·  ")}`
      : "";
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `🧪 *${tc.title || tc.name || "Unnamed"}*\n` +
          `ID: \`${tc.id}\`` +
          (tc.createdAt ? ` · ${new Date(tc.createdAt).toLocaleDateString()}` : "") +
          tagLine,
      },
    };
  });

  return [
    { type: "header", text: { type: "plain_text", text: "🧪 Your Test Cases" } },
    divider(),
    ...rows,
    ...(testCases.length > 45
      ? [{ type: "context", elements: [{ type: "mrkdwn", text: `_Showing 45 of ${testCases.length}. Use tags to group cases instead of listing all — copy a tag ID above and run with \`tag:<id>\`._` }] }]
      : []),
  ];
}

function formatAgents(agents) {
  if (!agents || agents.length === 0) {
    return [{ type: "section", text: { type: "mrkdwn", text: "_No voice agents found in your workspace._" } }];
  }

  const rows = agents.slice(0, 45).map((agent) => {
    const phones = Array.isArray(agent.phoneNumbers) && agent.phoneNumbers.length
      ? agent.phoneNumbers.map((p) => p.number || p.phoneNumber || p).join(", ")
      : null;
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `🤖 *${agent.name || "Unnamed Agent"}*\n` +
          `ID: \`${agent.id}\`` +
          (agent.provider ? ` · Provider: ${agent.provider}` : "") +
          (agent.industry ? ` · Industry: ${agent.industry}` : "") +
          (phones ? `\n📞 ${phones}` : ""),
      },
    };
  });

  return [
    { type: "header", text: { type: "plain_text", text: "🤖 Your Voice Agents" } },
    divider(),
    ...rows,
  ];
}

function formatAgentTags(tags, agentId) {
  if (!tags || tags.length === 0) {
    return [{ type: "section", text: { type: "mrkdwn", text: `_No tags attached to agent \`${agentId}\`._` } }];
  }

  const sorted = [...tags].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const rows = sorted.slice(0, 45).map((t) => {
    const count = t.testCaseCount != null ? `${t.testCaseCount} case${t.testCaseCount === 1 ? "" : "s"}` : "? cases";
    const desc = t.description ? `\n_${t.description}_` : "";
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🏷 *${t.name}* — ${count}\n\`${t.id}\`${desc}`,
      },
    };
  });

  return [
    { type: "header", text: { type: "plain_text", text: `🏷 Tags for agent` } },
    { type: "context", elements: [{ type: "mrkdwn", text: `Agent: \`${agentId}\` · ${tags.length} tag(s)` }] },
    divider(),
    ...rows,
    ...(tags.length > 45
      ? [{ type: "context", elements: [{ type: "mrkdwn", text: `_Showing 45 of ${tags.length}._` }] }]
      : []),
  ];
}

module.exports = {
  formatTestRunStatus,
  formatTestRunResults,
  formatTestCases,
  formatAgents,
  formatAgentTags,
};
