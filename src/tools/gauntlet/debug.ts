/**
 * Debug — run ONE checkout attempt with the full step-by-step trajectory
 * printed, so we can see exactly where the agent gets stuck.
 *
 *   npm run debug:gauntlet
 */
import { browsers } from "../../core/solari.js";
import { drive } from "../../core/agent.js";
import { suite } from "./suite.js";

const task = suite[0]; // Standard checkout
console.log(`Task: ${task.label}\nGoal: ${task.goal}\n`);

const browser = await browsers.launch({ recording: true });
try {
  const page = await browser.newPage();
  await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 20000 });
  console.log("=== TRAJECTORY (live) ===");
  const res = await drive(page, {
    goal: task.goal,
    onStep: (s) => {
      const fail = s.ok ? "" : `  [FAILED: ${s.note}]`;
      console.log(`${String(s.n).padStart(2)}. ${s.action}${s.target ? ` → ${s.target}` : ""}${fail}`);
      if (s.reasoning) console.log(`    ${s.reasoning}`);
    },
  });

  console.log("\n=== RESULT ===");
  console.log("final url  :", page.url());
  console.log("succeeded  :", res.succeeded);
  console.log("gaveUp     :", res.gaveUp, res.reason ? `(${res.reason})` : "");
  console.log("check()    :", await task.check(page));
} finally {
  await browser.close();
  await browsers.close();
}
