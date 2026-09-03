/**
 * Swarm engine — send each persona through the funnel N times, measure who
 * completes, and cluster *why* the rest dropped off.
 *
 * The value is the "why": analytics tells you where people leave; the personas
 * can tell you why, because each one narrates its own give-up reason. We cluster
 * the real give-ups (not the ones that merely ran out of steps) into themes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { browsers, config, launchBrowser } from "../../core/solari.js";
import { anthropic } from "../../core/llm.js";
import { drive, type Persona } from "../../core/agent.js";
import { pool, type Settled } from "../../core/pool.js";
import { writeReport, kpi, bar, section, cluster, esc } from "../../core/report.js";

interface Journey {
  persona: string;
  completed: boolean;
  gaveUp: boolean;
  reason?: string;
  sessionId?: string;
}

async function journey(persona: Persona, url: string, goal: string, successMarker?: string): Promise<Journey> {
  let browser: any;
  try {
    browser = await launchBrowser({ recording: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const res = await drive(page, { goal, persona });
    // If a success marker is given, verify the goal independently instead of
    // trusting the agent's self-reported finish.
    let completed = res.succeeded;
    if (completed && successMarker) {
      const finalText = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      completed = String(finalText).toLowerCase().includes(successMarker.toLowerCase());
    }
    return { persona: persona.name, completed, gaveUp: res.gaveUp, reason: res.reason, sessionId: browser.id };
  } catch (err: any) {
    return { persona: persona.name, completed: false, gaveUp: false, reason: String(err?.message ?? err), sessionId: browser?.id };
  } finally {
    if (browser) await browser.close();
  }
}

/** One LLM call: cluster raw give-up reasons into themes with counts + a quote. */
async function clusterReasons(reasons: string[]): Promise<Array<{ theme: string; count: number; example: string }>> {
  if (reasons.length === 0) return [];
  try {
    const msg = await anthropic.messages.create({
      model: config.agentModel,
      max_tokens: 800,
      system: "You cluster user drop-off reasons into 3-6 themes. Reply ONLY with a JSON array of {theme, count, example}, where example is a short representative quote. No prose.",
      messages: [{ role: "user", content: reasons.map((r, i) => `${i + 1}. ${r}`).join("\n") }],
    });
    const text = msg.content.find((c) => c.type === "text");
    const raw = text && "text" in text ? text.text : "[]";
    const json = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
    return JSON.parse(json);
  } catch {
    return [{ theme: "uncategorized", count: reasons.length, example: reasons[0] ?? "" }];
  }
}

export async function run(opts: { personas: Persona[]; runs: number; url: string; goal: string; successMarker?: string }): Promise<void> {
  await mkdir("reports", { recursive: true });

  const plan: Persona[] = [];
  for (const p of opts.personas) for (let k = 0; k < opts.runs; k++) plan.push(p);
  const total = plan.length;
  let done = 0;
  process.stdout.write(`Swarm: ${total} journeys (${opts.personas.length} personas × ${opts.runs}), ${config.concurrency} at a time…\n`);

  let results: Array<Settled<Journey>>;
  try {
    results = await pool(config.concurrency, plan.map((p) => () => journey(p, opts.url, opts.goal, opts.successMarker)), (_, r) => {
      done++;
      process.stdout.write(`  [${done}/${total}] ${r.ok ? (r.value.completed ? "completed" : "dropped") : "error"}\n`);
    });
  } finally {
    await browsers.close();
  }

  const journeys = results.filter((s): s is { ok: true; value: Journey } => s.ok).map((s) => s.value);

  const rows: string[] = [];
  let completedAll = 0;
  for (const p of opts.personas) {
    const mine = journeys.filter((j) => j.persona === p.name);
    const done_ = mine.filter((j) => j.completed).length;
    const rate = mine.length ? Math.round((done_ / mine.length) * 100) : 0;
    completedAll += done_;
    rows.push(bar(p.name, `completed ${done_}/${mine.length} · patience ${p.patience}`, rate));
    console.log(`  ${p.name.padEnd(26)} ${String(rate).padStart(3)}% completed (${done_}/${mine.length})`);
  }

  // Only cluster *real* give-ups (a persona choosing to quit, with a reason).
  // Journeys that merely ran out of steps aren't an authentic "why", so count
  // them separately instead of polluting the clusters with "ran out of steps".
  const gaveUpReasons = journeys.filter((j) => !j.completed && j.gaveUp && j.reason).map((j) => j.reason as string);
  const timedOut = journeys.filter((j) => !j.completed && !j.gaveUp).length;
  console.log(`\nClustering ${gaveUpReasons.length} give-up reasons (${timedOut} others couldn't finish in the step budget)…`);
  const clusters = await clusterReasons(gaveUpReasons);

  const extra = (gaveUpReasons.length || timedOut)
    ? section("Why they dropped off") +
      clusters.sort((a, b) => b.count - a.count).map((c) => cluster(c.count, `${esc(c.theme)} <em>"${esc(c.example)}"</em>`)).join("") +
      (timedOut ? cluster(timedOut, "couldn't complete within the step budget (no explicit give-up)") : "")
    : "";

  const overall = total ? Math.round((completedAll / total) * 100) : 0;
  await writeReport("reports/swarm.html", {
    title: "Swarm",
    subtitle: `${total} journeys · ${opts.personas.length} personas · synthetic users`,
    accent: "#0e8a8f",
    kpis: [
      kpi(`${overall}%`, "overall completion"),
      kpi(String(opts.personas.length), "personas"),
      kpi(String(opts.runs), "runs each"),
    ],
    rows,
    extra,
  });

  console.log(`Overall completion: ${overall}%   Report: reports/swarm.html`);

  const failedSessions = results.flatMap((s) => (s.ok && !s.value.completed && s.value.sessionId ? [s.value.sessionId] : []));
  if (failedSessions.length) {
    await writeFile("reports/swarm-failed-sessions.json", JSON.stringify(failedSessions, null, 2));
    console.log(`${failedSessions.length} drop-off sessions → reports/swarm-failed-sessions.json  (replay one: npm run replay -- <sessionId>)`);
  }
}
