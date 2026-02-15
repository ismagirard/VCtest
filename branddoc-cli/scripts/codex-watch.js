#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const https = require('https');

const repoRoot = process.cwd();
const reviewOutputPath = path.join(repoRoot, 'docs', 'review.md');
const claudeNextPath = path.join(repoRoot, 'docs', 'claude-next.md');
const claudeHandoffPath = path.join(repoRoot, 'docs', 'claude-handoff.md');
const reviewPromptPath = path.join(repoRoot, 'docs', 'review_prompt.txt');
const qaTrackerPath = path.join(repoRoot, 'docs', 'qa-tracker.json');
const qaOpenPath = path.join(repoRoot, 'docs', 'qa-open.md');
const qaStatePath = path.join(repoRoot, 'docs', 'qa-state.json');
const qaRubricPath = path.join(repoRoot, 'docs', 'qa-rubric.md');

const watchIncludes = new Set([
  'docs/plan.md',
  'docs/research.md',
]);
const ignoreExact = new Set([
  'docs/review.md',
  'docs/review_prompt.txt',
]);
const srcPrefix = 'src/';

const debounceMs = 800;
const reviewTimeoutMs = Number(process.env.CODEX_REVIEW_TIMEOUT_MS || 90000);
let timer = null;
let running = false;
let pending = false;

const RUBRIC = [
  { id: 'architecture', label: 'Architecture', desc: 'Boundaries, layering, coupling, modularity.', keywords: ['architecture', 'structure', 'boundary', 'layer', 'coupling', 'cohesion', 'modular', 'dependency', 'abstraction'] },
  { id: 'correctness', label: 'Correctness', desc: 'Logic correctness, edge cases, validation.', keywords: ['bug', 'error', 'incorrect', 'wrong', 'null', 'undefined', 'edge case', 'validation', 'input'] },
  { id: 'reliability', label: 'Reliability', desc: 'Timeouts, retries, idempotency, failure handling.', keywords: ['timeout', 'retry', 'idempot', 'race', 'concurrency', 'failure', 'resilience', 'fallback'] },
  { id: 'testing', label: 'Test Coverage', desc: 'Missing or weak tests/regression coverage.', keywords: ['test', 'coverage', 'regression', 'unit test', 'integration test'] },
  { id: 'security', label: 'Security', desc: 'Auth/authz, secrets, sanitization, data exposure.', keywords: ['security', 'auth', 'authorization', 'authentication', 'secret', 'token', 'injection', 'sanitize', 'permission'] },
  { id: 'maintainability', label: 'Maintainability', desc: 'Readability, complexity, technical debt.', keywords: ['maintain', 'readability', 'complex', 'refactor', 'technical debt', 'smell', 'duplication'] },
  { id: 'scalability', label: 'Scalability', desc: 'Performance and growth bottlenecks.', keywords: ['performance', 'scalability', 'bottleneck', 'latency', 'throughput', 'n+1', 'memory'] },
];

function normalizeRel(rel) {
  if (!rel) return '';
  return rel.split(path.sep).join('/');
}

function shouldTrigger(rel) {
  if (!rel) return false;
  const p = normalizeRel(rel);
  if (ignoreExact.has(p) || ignoreExact.has(p.split('/').slice(-2).join('/'))) return false;
  if (watchIncludes.has(p) || p.endsWith('/docs/plan.md') || p.endsWith('/docs/research.md')) return true;
  if (p.startsWith(srcPrefix) || p.includes('/src/')) return true;
  return false;
}

function log(msg) {
  process.stdout.write(`${new Date().toISOString()} ${msg}\n`);
}

function notify(title, message) {
  const safeTitle = (title || 'Codex QA').replace(/"/g, "'");
  const safeMessage = (message || '').replace(/"/g, "'").slice(0, 220);
  execFile('/usr/bin/osascript', [
    '-e',
    `display notification "${safeMessage}" with title "${safeTitle}"`,
  ], () => {});
  notifyPush(safeTitle, safeMessage);
  notifySlack(safeTitle, safeMessage);
}

function notifyPush(title, message) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  const sendFullPrompt = process.env.NTFY_FULL_PROMPT === '1';
  let body = message;
  if (sendFullPrompt) {
    try {
      body = fs.readFileSync(claudeHandoffPath, 'utf8');
    } catch (_) {
      body = message;
    }
  }
  if (body.length > 3800) {
    body = `${body.slice(0, 3800)}\n\n[truncated] Open docs/claude-handoff.md for full content.`;
  }

  const req = https.request({
    hostname: 'ntfy.sh',
    path: `/${encodeURIComponent(topic)}`,
    method: 'POST',
    headers: {
      'Title': title,
      'Priority': 'default',
      'Tags': 'rotating_light',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  }, (res) => {
    res.resume();
  });

  req.on('error', () => {});
  req.write(body);
  req.end();
}

function notifySlack(title, message) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  let text = `*${title}*\n${message}`;
  if (process.env.SLACK_FULL_PROMPT === '1') {
    try {
      text = fs.readFileSync(claudeHandoffPath, 'utf8');
    } catch (_) {
      // Keep fallback short message
    }
  }
  if (text.length > 3500) {
    text = `${text.slice(0, 3500)}\n\n[truncated] Open docs/claude-handoff.md for full content.`;
  }

  let url;
  try {
    url = new URL(webhook);
  } catch (_) {
    return;
  }

  const payload = JSON.stringify({ text });
  const req = https.request({
    hostname: url.hostname,
    path: `${url.pathname}${url.search}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, (res) => {
    res.resume();
  });

  req.on('error', () => {});
  req.write(payload);
  req.end();
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(qaStatePath, 'utf8'));
  } catch (_) {
    return { lastOpenCount: 0, lastTopKey: null, lastFailedCategoriesKey: '' };
  }
}

function saveState(state) {
  fs.writeFileSync(qaStatePath, JSON.stringify(state, null, 2), 'utf8');
}

function categoryMatchesIssue(category, issue) {
  const text = `${issue.text || ''} ${issue.path || ''}`.toLowerCase();
  return category.keywords.some((kw) => text.includes(kw));
}

function computeRubric(openIssues) {
  return RUBRIC.map((cat) => {
    const hits = openIssues.filter((issue) => categoryMatchesIssue(cat, issue));
    return {
      id: cat.id,
      label: cat.label,
      desc: cat.desc,
      pass: hits.length === 0,
      hits: hits.slice(0, 3),
    };
  });
}

function writeRubricReport(openIssues) {
  const results = computeRubric(openIssues);
  const failed = results.filter((r) => !r.pass);
  const lines = [
    '# QA Rubric',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    `Result: ${failed.length === 0 ? 'PASS' : `FAIL (${failed.length} category failures)`}`,
    '',
  ];

  for (const r of results) {
    lines.push(`- ${r.pass ? '[PASS]' : '[FAIL]'} ${r.label}: ${r.desc}`);
    if (!r.pass) {
      for (const hit of r.hits) {
        lines.push(`  - [${hit.severity}] ${hit.text}${hit.path ? ` (${hit.path})` : ''}`);
      }
    }
  }

  fs.writeFileSync(qaRubricPath, lines.join('\n'), 'utf8');
  return { results, failed };
}

function maybeNotifyOpenIssues(openIssues) {
  const state = loadState();
  const top = openIssues[0] || null;
  const topKey = top ? `${top.severity}|${top.path || ''}|${top.text || ''}` : null;
  const rubric = computeRubric(openIssues);
  const failed = rubric.filter((r) => !r.pass);
  const failedCategoriesKey = failed.map((x) => x.id).sort().join('|');
  const becameActionable = state.lastOpenCount === 0 && openIssues.length > 0;
  const topChanged = openIssues.length > 0 && state.lastTopKey !== topKey;
  const categoriesChanged = state.lastFailedCategoriesKey !== failedCategoriesKey;

  if (openIssues.length > 0 && failed.length > 0 && (becameActionable || topChanged || categoriesChanged)) {
    const msg = `${top.severity}: ${openIssues.length} open issue(s), ${failed.length} rubric failure(s). ${(top.text || '').slice(0, 100)}`;
    notify('Codex QA Action Needed', msg);
  }

  saveState({
    lastOpenCount: openIssues.length,
    lastTopKey: topKey,
    lastFailedCategoriesKey: failedCategoriesKey,
    updatedAt: new Date().toISOString(),
  });
}

function severityRank(label) {
  const map = { P0: 0, P1: 1, P2: 2, P3: 3, INFO: 4 };
  return Object.prototype.hasOwnProperty.call(map, label) ? map[label] : 4;
}

function inferSeverity(text) {
  const t = text.toLowerCase();
  if (/\bp0\b|\bcritical\b|\bblocker\b/.test(t)) return 'P0';
  if (/\bp1\b|\bhigh\b/.test(t)) return 'P1';
  if (/\barchitecture\b|\bstructur(e|al)\b|\bcoupling\b|\bboundar(y|ies)\b/.test(t)) return 'P2';
  if (/\bp2\b|\bmedium\b/.test(t)) return 'P2';
  if (/\bp3\b|\blow\b/.test(t)) return 'P3';
  return 'INFO';
}

function collectIssues(reviewText) {
  const cleanHeading = (line) => line.replace(/\*/g, '').replace(/:$/, '').trim().toLowerCase();
  const isHeading = (line, name) => {
    const c = cleanHeading(line);
    return c === name || c.startsWith(`${name} `);
  };

  const lines = reviewText.split('\n');
  let inIssuesSection = false;

  const scopedLines = lines
    .map((raw) => raw.trim())
    .filter((line) => {
      if (/^#{1,6}\s+issues\b/i.test(line) || isHeading(line, 'issues')) {
        inIssuesSection = true;
        return false;
      }
      if (/^#{1,6}\s+suggested next steps\b/i.test(line) || isHeading(line, 'suggested next steps')) {
        inIssuesSection = false;
        return false;
      }
      if (/^#{1,6}\s+summary\b/i.test(line) || isHeading(line, 'summary')) {
        inIssuesSection = false;
        return false;
      }
      if (/^#{1,6}\s+/i.test(line) && !/^#{1,6}\s+issues\b/i.test(line)) {
        // Any new heading ends the scoped issues section.
        inIssuesSection = false;
      }
      return inIssuesSection;
    });

  const candidates = scopedLines.length ? scopedLines : lines.map((l) => l.trim());

  const issueLines = candidates
    .filter((line) => {
      if (!line) return false;
      if (!line.startsWith('-') && !line.startsWith('*')) return false;
      const l = line.toLowerCase();
      return (
        l.includes('risk') ||
        l.includes('bug') ||
        l.includes('missing') ||
        l.includes('should') ||
        l.includes('error') ||
        l.includes('regression') ||
        l.includes('test') ||
        l.includes('architecture') ||
        l.includes('structure') ||
        l.includes('modular') ||
        l.includes('coupling') ||
        l.includes('cohesion') ||
        l.includes('abstraction') ||
        l.includes('separation of concerns') ||
        l.includes('layering') ||
        l.includes('boundary') ||
        l.includes('dependency')
      );
    });

  const parsed = issueLines.map((line) => {
    const sevMatch = line.match(/\b(P0|P1|P2|P3)\b/i);
    const severity = sevMatch ? sevMatch[1].toUpperCase() : inferSeverity(line);
    const pathMatch = line.match(/\b(?:src|docs|scripts)\/[A-Za-z0-9._\-\/]+/);
    return { line, severity, path: pathMatch ? pathMatch[0] : null };
  });

  parsed.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return parsed.slice(0, 8);
}

function issueText(line) {
  return line.replace(/^[-*]\s*/, '').trim();
}

function stableIssueId(issue) {
  const text = issueText(issue.line)
    .replace(/\bP[0-3]\b/gi, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
  return `${issue.path || 'no-path'}|${issue.severity}|${text}`;
}

function loadTracker() {
  try {
    return JSON.parse(fs.readFileSync(qaTrackerPath, 'utf8'));
  } catch (_) {
    return { version: 1, issues: {}, updatedAt: null };
  }
}

function saveTracker(tracker) {
  tracker.updatedAt = new Date().toISOString();
  fs.writeFileSync(qaTrackerPath, JSON.stringify(tracker, null, 2), 'utf8');
}

function getOpenIssuesFromTracker(tracker) {
  return Object.values(tracker.issues || {})
    .filter((x) => x.status === 'open')
    .sort((a, b) => {
      const sev = severityRank(a.severity) - severityRank(b.severity);
      if (sev !== 0) return sev;
      return a.firstSeen.localeCompare(b.firstSeen);
    });
}

function writeOpenChecklist(openIssues) {
  const body = [
    '# QA Open Issues',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    openIssues.length ? `Open count: ${openIssues.length}` : 'Open count: 0',
    '',
    ...(openIssues.length
      ? openIssues.map((i) => `- [ ] [${i.severity}] ${i.text}${i.path ? ` (${i.path})` : ''}`)
      : ['- No open QA issues.']),
  ].join('\n');
  fs.writeFileSync(qaOpenPath, body, 'utf8');
}

function reasonForIssue(text) {
  const t = text.toLowerCase();
  if (t.includes('test') || t.includes('missing test')) return 'Coverage gap can let regressions ship silently.';
  if (t.includes('bug') || t.includes('error') || t.includes('crash')) return 'This is a correctness issue and can break behavior for users.';
  if (t.includes('architecture') || t.includes('structure') || t.includes('coupling') || t.includes('boundary') || t.includes('dependency')) {
    return 'Weak app fundamentals increase maintenance cost and create hidden regression risk.';
  }
  if (t.includes('risk') || t.includes('regression')) return 'This is a structural risk that can reappear in future changes.';
  if (t.includes('should')) return 'Current implementation likely violates intended design or contract.';
  return 'This issue impacts reliability/maintainability and should be addressed.';
}

function doneWhenForIssue(issue) {
  const target = issue.path ? ` at ${issue.path}` : '';
  return `Code updated${target}, tests updated/added, and QA no longer reports this item as open.`;
}

function writeClaudeHandoff(openIssues, headerNote = null) {
  const rubric = computeRubric(openIssues);
  const failed = rubric.filter((r) => !r.pass);
  const lines = [
    '# Claude Handoff (Auto-Updated)',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
  ];

  if (headerNote) {
    lines.push(`Note: ${headerNote}`, '');
  }

  if (!openIssues.length) {
    lines.push('No open QA issues right now.', '', 'If new changes were made, run/save changes and wait for next QA cycle.');
    fs.writeFileSync(claudeHandoffPath, lines.join('\n'), 'utf8');
    return;
  }

  lines.push('Rubric status:', failed.length === 0 ? '- PASS (no failed categories)' : `- FAIL (${failed.length} categories): ${failed.map((x) => x.label).join(', ')}`, '');

  lines.push(
    'Paste this whole message into Claude Code:',
    '```',
    'Apply only the following open QA fixes, in order.',
    'For each item: implement the change, explain why, and update/add tests.',
    '',
    'Open items:'
  );

  for (const issue of openIssues) {
    lines.push(`- [${issue.severity}] ${issue.text}`);
    lines.push(`  - File: ${issue.path || '(not specified)'}`);
    lines.push(`  - Why: ${reasonForIssue(issue.text || '')}`);
    lines.push(`  - Done when: ${doneWhenForIssue(issue)}`);
  }

  lines.push(
    '',
    'After finishing, return:',
    '- files changed',
    '- tests added/updated',
    '- any remaining risks',
    '```',
    '',
    `Source review: ${path.relative(repoRoot, reviewOutputPath)}`,
    `Open checklist: ${path.relative(repoRoot, qaOpenPath)}`,
    `Rubric report: ${path.relative(repoRoot, qaRubricPath)}`
  );

  fs.writeFileSync(claudeHandoffPath, lines.join('\n'), 'utf8');
}

function syncTrackerWithIssues(issues) {
  const tracker = loadTracker();
  const now = new Date().toISOString();
  const seen = new Set();

  for (const issue of issues) {
    const id = stableIssueId(issue);
    seen.add(id);
    const existing = tracker.issues[id];
    const text = issueText(issue.line);
    if (!existing) {
      tracker.issues[id] = {
        id,
        status: 'open',
        severity: issue.severity,
        path: issue.path,
        text,
        firstSeen: now,
        lastSeen: now,
        resolvedAt: null,
        occurrences: 1,
      };
    } else {
      existing.status = 'open';
      existing.severity = issue.severity;
      existing.path = issue.path;
      existing.text = text;
      existing.lastSeen = now;
      existing.resolvedAt = null;
      existing.occurrences = (existing.occurrences || 0) + 1;
    }
  }

  for (const item of Object.values(tracker.issues)) {
    if (item.status === 'open' && !seen.has(item.id)) {
      item.status = 'resolved';
      item.resolvedAt = now;
    }
  }

  saveTracker(tracker);
  const open = getOpenIssuesFromTracker(tracker);
  writeOpenChecklist(open);
  writeRubricReport(open);
  return open;
}

function writeClaudeNext(issues, options = {}) {
  const headerNote = options.headerNote || null;
  const instructions = issues.map((issue, idx) => {
    const target = issue.path ? ` in ${issue.path}` : '';
    const text = issue.text || issueText(issue.line || '');
    return `${idx + 1}. [${issue.severity}] Fix${target}: ${text}`;
  });
  const body = [
    '# What to tell Claude',
    '',
    ...(headerNote ? [headerNote, ''] : []),
    'Use this exact prompt:',
    '',
    '```',
    'Please apply these QA fixes from Codex, in priority order.',
    'For each item: implement the code change, add/adjust tests, and summarize what changed.',
    '',
    'Tell Claude:',
    instructions.length ? instructions.join('\n') : '1. Re-run QA after additional code changes. No concrete issues were extracted.',
    '',
    'After fixing, provide:',
    '- changed files',
    '- why each fix was needed',
    '- what tests were added/updated',
    '```',
    '',
    `Source review: ${path.relative(repoRoot, reviewOutputPath)}`,
    `Open checklist: ${path.relative(repoRoot, qaOpenPath)}`,
  ].join('\n');
  fs.writeFileSync(claudeNextPath, body, 'utf8');
  writeClaudeHandoff(issues, headerNote);
}

function buildReviewPrompt() {
  try {
    const custom = fs.readFileSync(reviewPromptPath, 'utf8').trim();
    if (custom) return custom;
  } catch (_) {
    // Fall back to default prompt.
  }

  return [
    'Review the current workspace snapshot for implementation risks.',
    'Focus on: architecture, correctness, reliability, test coverage, security, maintainability, and scalability.',
    'Return only concise bullet findings with this format:',
    '- P0|P1|P2|P3 (Category) file/path: issue and impact',
    'If no issues exist, return exactly: NO_ISSUES',
  ].join('\n');
}

function runReview() {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  log('Running Codex review...');

  const model = process.env.CODEX_REVIEW_MODEL;
  const configArgs = model ? ['-c', `model="${model}"`] : [];
  const prompt = buildReviewPrompt();
  const args = ['exec', ...configArgs, '-'];
  const codexBin = process.env.CODEX_BIN || 'codex';
  const codex = spawn(codexBin, args, {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let completed = false;
  const reviewTimeout = setTimeout(() => {
    if (completed) return;
    codex.kill('SIGKILL');
    const body = [
      '# Review (error)',
      '',
      `Codex review timed out after ${Math.floor(reviewTimeoutMs / 1000)}s.`,
      '',
      'Try again after checking Codex auth/network.',
    ].join('\n');
    fs.writeFileSync(reviewOutputPath, body, 'utf8');
    const open = getOpenIssuesFromTracker(loadTracker());
    writeClaudeNext(open, { headerNote: 'Latest QA run failed. Use current open issues below.' });
    notify('Codex QA', 'Review timed out. Check docs/review.md');
    log('Review timed out. See docs/review.md');
    running = false;
    if (pending) {
      pending = false;
      setTimeout(runReview, 200);
    }
  }, reviewTimeoutMs);

  let out = '';
  let errOut = '';

  codex.stdout.on('data', (chunk) => {
    out += chunk.toString();
  });

  codex.stderr.on('data', (chunk) => {
    errOut += chunk.toString();
  });

  codex.on('error', (err) => {
    if (completed) return;
    completed = true;
    clearTimeout(reviewTimeout);
    const body = [
      '# Review (error)',
      '',
      `Failed to start Codex binary: ${codexBin}`,
      '',
      '## error',
      '```',
      err.message,
      '```',
    ].join('\n');
    fs.writeFileSync(reviewOutputPath, body, 'utf8');
    const open = getOpenIssuesFromTracker(loadTracker());
    writeClaudeNext(open, { headerNote: 'Latest QA run failed. Use current open issues below.' });
    notify('Codex QA', 'Watcher could not start Codex. See docs/review.md');
    log(`Failed to start Codex (${codexBin}). See docs/review.md`);
    running = false;
  });

  codex.on('close', (code) => {
    if (completed) return;
    completed = true;
    clearTimeout(reviewTimeout);
    if (code === 0) {
      const trimmed = (out || '').trim();
      const finalOut = !trimmed
        ? [
            '# Review (error)',
            '',
            'Codex returned empty output.',
            '',
            '- P1 (QA Pipeline) docs/review.md: Empty QA response prevents risk detection and should be treated as a failed QA pass.',
          ].join('\n')
        : (trimmed === 'NO_ISSUES' ? '# Review\n\nNO_ISSUES\n' : out);
      fs.writeFileSync(reviewOutputPath, finalOut, 'utf8');
      const currentIssues = collectIssues(finalOut);
      const openIssues = syncTrackerWithIssues(currentIssues);
      writeClaudeNext(openIssues);
      maybeNotifyOpenIssues(openIssues);
      log(`Review written to ${path.relative(repoRoot, reviewOutputPath)}`);
    } else {
      const body = [
        '# Review (error)',
        '',
        `Codex review failed with exit code ${code}.`,
        '',
        '## stderr',
        '```',
        errOut || '(empty)',
        '```',
      ].join('\n');
      fs.writeFileSync(reviewOutputPath, body, 'utf8');
      const open = getOpenIssuesFromTracker(loadTracker());
      writeClaudeNext(open, { headerNote: 'Latest QA run failed. Use current open issues below.' });
      notify('Codex QA', 'Review failed. Check docs/review.md');
      log(`Review failed (exit ${code}). See docs/review.md`);
    }

    running = false;
    if (pending) {
      pending = false;
      setTimeout(runReview, 200);
    }
  });

  codex.stdin.write(prompt);
  codex.stdin.end();

}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(runReview, debounceMs);
}

let lastSignature = '';

function walkFiles(absDir, relPrefix, out) {
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    const rel = normalizeRel(path.join(relPrefix, entry.name));
    if (entry.isDirectory()) {
      walkFiles(abs, rel, out);
      continue;
    }
    if (entry.isFile() && shouldTrigger(rel)) {
      const stat = fs.statSync(abs);
      out.push(`${rel}|${stat.size}|${Math.floor(stat.mtimeMs)}`);
    }
  }
}

function pollStatus() {
  const watched = [];
  walkFiles(path.join(repoRoot, 'src'), 'src', watched);
  walkFiles(path.join(repoRoot, 'docs'), 'docs', watched);
  watched.sort();
  const signature = watched.join('\n');
  if (!signature) return;

  if (!lastSignature) {
    lastSignature = signature;
    return;
  }

  if (signature !== lastSignature) {
    lastSignature = signature;
    log('Change detected in watched files');
    schedule();
  }
}

function startWatcher() {
  const tracker = loadTracker();
  const open = getOpenIssuesFromTracker(tracker);
  writeOpenChecklist(open);
  writeRubricReport(open);
  writeClaudeNext(open);
  log('Starting watcher (file polling)...');
  setInterval(pollStatus, 2000);
  pollStatus();
}

startWatcher();
