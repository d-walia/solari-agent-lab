/**
 * slipstream — can AI agents actually get through your product's flows?
 *
 *   npm run slipstream                                  # default baseline flow
 *   npm run slipstream -- --runs 5                      # 5 attempts per flow
 *   npm run slipstream -- --url https://your.site --goal "sign up and reach the dashboard"
 */
import { flows as defaultFlows, type Flow } from "./flows.js";
import { run } from "./run.js";

const args = process.argv.slice(2);
const val = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const runs = Number(val("--runs") ?? 5);
const url = val("--url");
const goal = val("--goal");

let flows: Flow[] = defaultFlows;
if (url && goal) {
  flows = [{ id: "custom", label: val("--label") ?? "Custom flow", url, goal }];
} else if (url || goal) {
  console.error("Pass BOTH --url and --goal to test a custom flow.");
  process.exit(1);
}

if (!Number.isFinite(runs) || runs < 1) {
  console.error("--runs must be a positive number");
  process.exit(1);
}

run({ flows, runs }).catch((err) => {
  console.error(err);
  process.exit(1);
});
