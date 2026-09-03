/**
 * swarm — where do users drop off in your funnel, and why?
 *
 *   npm run swarm                                   # 10 runs per persona, default funnel
 *   npm run swarm -- --runs 15
 *   npm run swarm -- --url https://your.site --goal "sign up and reach the dashboard"
 *   npm run swarm -- --success "dashboard"   # verify completion by page text, not self-report
 */
import { personas } from "./personas.js";
import { run } from "./run.js";

const args = process.argv.slice(2);
const val = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

// Default to at least 10 runs per persona — you need a real sample to see a rate.
const runs = Math.max(10, Number(val("--runs") ?? 10));
// Defaults to the project's own flawed funnel, where personas actually drop off.
const url = val("--url") ?? "https://d-walia.github.io/solari-agent-lab/demo-funnel/";
const goal = val("--goal") ?? "Sign up for Nimbus and reach the dashboard.";
// Optional: text that must appear on the final page to count as completed.
// Without it, completion trusts the agent's own "finish" call. For the default
// funnel, pass:  --success "dashboard"
const successMarker = val("--success");

run({ personas, runs, url, goal, successMarker }).catch((err) => {
  console.error(err);
  process.exit(1);
});
