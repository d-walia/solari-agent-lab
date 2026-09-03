/**
 * Gauntlet engine — fan each task out to K trials, score the distribution,
 * diff against the last run.
 *
 * The whole point: one pass tells you nothing about a non-deterministic agent.
 * K passes give you a success RATE, and the diff vs baseline turns "feels
 * flakier since I changed the prompt" into a number.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { browsers, config, launchBrowser } from "../../core/solari.js";
import { drive } from "../../core/agent.js";
import { pool, type Settled } from "../../core/pool.js";
import { writeReport, kpi, bar } from "../../core/report.js";
import { suite, type Task } from "./suite.js";

interface Trial {
  taskId: string;
  passed: boolean;
  gaveUp: boolean;
  reason?: string;
  steps: number;
  sessionId?: string;
}

async function runTrial(task: Task): Promise<Trial> {
  let browser: any;
  try {
    browser = await launchBrowser({ recording: true });
    const page = await browser.newPage();
    await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const res = await drive(page, { goal: task.goal });
    const passed = res.succeeded && (await task.check(page));
    return { taskId: task.id, passed, gaveUp: res.gaveUp, reason: res.reason, steps: res.steps.length, sessionId: browser.id };
  } catch (err: any) {
    return { taskId: task.id, passed: false, gaveUp: false, reason: String(err?.message ?? err), steps: 0, sessionId: browser?.id };
  } finally {
    if (browser) await browser.close();
  }
}

const BASELINE = "reports/gauntlet-baseline.json";

export async function run(opts: { trials: number; saveBaseline: boolean }): Promise<void> {
  await mkdir("reports", { recursive: true });

  // Build the flat job list: every task × every trial.
  const plan: Task[] = [];
  for (const task of suite) for (let k = 0; k < opts.trials; k++) plan.push(task);

  const total = plan.length;
  let done = 0;
  process.stdout.write(`Running ${total} trials (${suite.length} tasks × ${opts.trials}), ${config.concurrency} at a time…\n`);

  let results: Array<Settled<Trial>>;
  try {
    results = await pool(config.concurrency, plan.map((t) => () => runTrial(t)), (_, r) => {
      done++;
      const v = r.ok ? r.value : null;
      const tag = !v ? "error" : v.passed ? "pass" : v.gaveUp ? "gave up" : `fail: ${(v.reason ?? "").slice(0, 70)}`;
      process.stdout.write(`  [${done}/${total}] ${tag}\n`);
    });
  } finally {
    // REQUIRED once at the end or Node never exits (see core/solari.ts).
    await browsers.close();
  }

  // Collapse trials → per-task rate.
  const byTask = new Map<string, Trial[]>();
  for (const s of results) if (s.ok) (byTask.get(s.value.taskId) ?? byTask.set(s.value.taskId, []).get(s.value.taskId)!).push(s.value);

  const baseline: Record<string, number> = await readFile(BASELINE, "utf8").then(JSON.parse).catch(() => ({}));
  const rates: Record<string, number> = {};
  const rows: string[] = [];
  let passedAll = 0;
  let regressed = 0;

  for (const task of suite) {
    const trials = byTask.get(task.id) ?? [];
    const passed = trials.filter((t) => t.passed).length;
    const rate = trials.length ? Math.round((passed / trials.length) * 100) : 0;
    rates[task.id] = rate;
    passedAll += passed;

    const base = baseline[task.id];
    const delta = base === undefined ? "" : ` · ${rate - base >= 0 ? "+" : ""}${rate - base} vs last`;
    if (base !== undefined && rate < base - 10) regressed++;

    const failReasons = trials.filter((t) => !t.passed).map((t) => t.reason).filter(Boolean).slice(0, 1);
    const note = failReasons.length ? ` · e.g. "${String(failReasons[0]).slice(0, 60)}"` : "";
    rows.push(bar(task.label, `${task.sub} · ${passed}/${trials.length}${delta}${note}`, rate));

    console.log(`  ${task.label.padEnd(24)} ${String(rate).padStart(3)}%  (${passed}/${trials.length})${delta}`);
  }

  const overall = total ? Math.round((passedAll / total) * 100) : 0;
  const baseOverall = Object.keys(baseline).length
    ? Math.round(suite.reduce((s, t) => s + (baseline[t.id] ?? 0), 0) / suite.length)
    : undefined;
  const vsBaseline = baseOverall === undefined ? "—" : `${overall - baseOverall >= 0 ? "+" : ""}${overall - baseOverall}`;
  const overallDelta = baseOverall === undefined ? "first run — no baseline yet" : `${vsBaseline} pts vs last run`;

  await writeReport("reports/gauntlet.html", {
    title: "Gauntlet",
    subtitle: `${total} trials · ${suite.length} tasks · agent reliability`,
    accent: "#db4e1b",
    kpis: [
      kpi(`${overall}%`, "overall pass rate"),
      kpi(vsBaseline, "vs baseline"),
      kpi(String(regressed), "tasks regressed"),
    ],
    rows,
  });

  console.log(`\nOverall: ${overall}%  (${overallDelta})`);
  console.log(`Report: reports/gauntlet.html`);

  // Forensics: save the sessions of failed trials so their replays are retrievable.
  const failedSessions = results.flatMap((s) => (s.ok && !s.value.passed && s.value.sessionId ? [s.value.sessionId] : []));
  if (failedSessions.length) {
    await writeFile("reports/gauntlet-failed-sessions.json", JSON.stringify(failedSessions, null, 2));
    console.log(`${failedSessions.length} failed sessions → reports/gauntlet-failed-sessions.json  (replay one: npm run replay -- <sessionId>)`);
  }

  if (opts.saveBaseline) {
    await writeFile(BASELINE, JSON.stringify(rates, null, 2));
    console.log(`Saved baseline → ${BASELINE}`);
  }
}
