/**
 * gauntlet — measure how reliably an agent completes a task.
 *
 *   npm run gauntlet -- --trials 5           run 5 trials per task
 *   npm run gauntlet -- --trials 10 --baseline   ...and save as the baseline
 *
 * First run: use --baseline to record the "before". Change your agent (edit the
 * model in .env or the prompt in core/agent.ts), run again without --baseline,
 * and the report shows the regression.
 */
import { run } from "./run.js";

const args = process.argv.slice(2);
const trialsArg = args.indexOf("--trials");
const trials = trialsArg >= 0 ? Number(args[trialsArg + 1]) : 3;
const saveBaseline = args.includes("--baseline");

if (!Number.isFinite(trials) || trials < 1) {
  console.error("--trials must be a positive number");
  process.exit(1);
}

run({ trials, saveBaseline }).catch((err) => {
  console.error(err);
  process.exit(1);
});
