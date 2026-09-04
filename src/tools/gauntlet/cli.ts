/**
 * gauntlet — measure how reliably an agent completes a task.
 *
 * Default (the built-in saucedemo suite):
 *   npm run gauntlet -- --trials 10 --baseline
 *
 * Ad-hoc, against any real target (like slipstream/swarm):
 *   npm run gauntlet -- --url https://your.site --goal "do X and reach Y" --success "Y" --trials 10
 *
 * With a custom target, --success is the text that must appear on the final page
 * to count a run as passed. Without it, a run counts as passed when the agent
 * says it finished (less rigorous — prefer --success for a real number).
 */
import { run } from "./run.js";
import type { Task } from "./suite.js";

const args = process.argv.slice(2);
const val = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const trials = Number(val("--trials") ?? 3);
const saveBaseline = args.includes("--baseline");
const url = val("--url");
const goal = val("--goal");
const successMarker = val("--success");

if (!Number.isFinite(trials) || trials < 1) {
  console.error("--trials must be a positive number");
  process.exit(1);
}

let tasks: Task[] | undefined;
if (url && goal) {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "custom";
    }
  })();
  const check = async (page: any): Promise<boolean> => {
    if (!successMarker) return true; // no marker → trust the agent's own finish
    try {
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      return String(text).toLowerCase().includes(successMarker.toLowerCase());
    } catch {
      return false;
    }
  };
  tasks = [{ id: "custom", label: val("--label") ?? "Custom task", sub: host, url, goal, check }];
} else if (url || goal) {
  console.error("Pass BOTH --url and --goal to run a custom task.");
  process.exit(1);
}

run({ trials, saveBaseline, tasks }).catch((err) => {
  console.error(err);
  process.exit(1);
});
