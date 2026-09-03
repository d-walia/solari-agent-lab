/**
 * Slipstream engine — run a plain agent at each flow K times, score how often
 * it gets through, and cluster the barriers when it doesn't.
 */
import { mkdir } from "node:fs/promises";
import { browsers, config, launchBrowser } from "../../core/solari.js";
import { drive } from "../../core/agent.js";
import { pool, type Settled } from "../../core/pool.js";
import { writeReport, kpi, bar, section, cluster } from "../../core/report.js";
import { classify, hintFor, type Barrier, type Flow } from "./flows.js";

interface Attempt {
  flowId: string;
  got_through: boolean;
  barrier?: Barrier;
  reason?: string;
  sessionId?: string;
}

async function attempt(flow: Flow): Promise<Attempt> {
  let browser: any;
  try {
    browser = await launchBrowser({ stealth: true, recording: true });
    const page = await browser.newPage();
    await page.goto(flow.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const res = await drive(page, { goal: flow.goal });
    if (res.succeeded) return { flowId: flow.id, got_through: true, sessionId: browser.id };
    let endText = "";
    try {
      endText = (await page.content()).replace(/<[^>]+>/g, " ").slice(0, 4000);
    } catch {
      /* page gone */
    }
    return { flowId: flow.id, got_through: false, barrier: classify(res.reason, endText), reason: res.reason, sessionId: browser.id };
  } catch (err: any) {
    return { flowId: flow.id, got_through: false, barrier: "other", reason: String(err?.message ?? err), sessionId: browser?.id };
  } finally {
    if (browser) await browser.close();
  }
}

export async function run(opts: { flows: Flow[]; runs: number }): Promise<void> {
  await mkdir("reports", { recursive: true });

  const plan: Flow[] = [];
  for (const f of opts.flows) for (let k = 0; k < opts.runs; k++) plan.push(f);
  const total = plan.length;
  let done = 0;
  process.stdout.write(`Slipstream: ${total} attempts (${opts.flows.length} flows × ${opts.runs}), ${config.concurrency} at a time…\n`);

  let results: Array<Settled<Attempt>>;
  try {
    results = await pool(config.concurrency, plan.map((f) => () => attempt(f)), (_, r) => {
      done++;
      const tag = r.ok ? (r.value.got_through ? "through" : `blocked:${r.value.barrier}`) : "error";
      process.stdout.write(`  [${done}/${total}] ${tag}\n`);
    });
  } finally {
    await browsers.close();
  }

  const attempts = results.filter((s): s is { ok: true; value: Attempt } => s.ok).map((s) => s.value);

  const rows: string[] = [];
  const barrierCounts = new Map<Barrier, number>();
  let throughAll = 0;

  for (const flow of opts.flows) {
    const mine = attempts.filter((a) => a.flowId === flow.id);
    const through = mine.filter((a) => a.got_through).length;
    const rate = mine.length ? Math.round((through / mine.length) * 100) : 0;
    throughAll += through;
    for (const a of mine) if (!a.got_through && a.barrier) barrierCounts.set(a.barrier, (barrierCounts.get(a.barrier) ?? 0) + 1);
    rows.push(bar(flow.label, `agent got through ${through}/${mine.length}`, rate));
    console.log(`  ${flow.label.padEnd(26)} ${String(rate).padStart(3)}% through (${through}/${mine.length})`);
  }

  const barriers = [...barrierCounts.entries()].sort((a, b) => b[1] - a[1]);
  const extra = barriers.length
    ? section("Top barriers — why agents couldn't get through") +
      barriers.map(([b, c]) => cluster(c, `<b>${b}</b> — ${hintFor(b)}`)).join("")
    : "";

  const readiness = total ? Math.round((throughAll / total) * 100) : 0;
  await writeReport("reports/slipstream.html", {
    title: "Slipstream",
    subtitle: `${total} attempts · ${opts.flows.length} flows · agent-readiness`,
    accent: "#0e8a8f",
    kpis: [
      kpi(`${readiness}%`, "agent completion rate"),
      kpi(String(barriers.length), "barrier types found"),
      kpi(String(opts.flows.length), "flows tested"),
    ],
    rows,
    extra,
  });

  console.log(`\nAgent-readiness: ${readiness}%   Report: reports/slipstream.html`);
  if (barriers.length) console.log(`Top barrier: ${barriers[0][0]} (${barriers[0][1]}×)`);
}
