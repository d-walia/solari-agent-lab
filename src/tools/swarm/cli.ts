/**
 * swarm — where do users drop off in your funnel, and why?
 *
 *   npm run swarm                                   # 10 runs per persona, default funnel
 *   npm run swarm -- --runs 15
 *   npm run swarm -- --url https://your.site --goal "sign up and reach the dashboard"
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
const url = val("--url") ?? "https://www.saucedemo.com/";
const goal =
  val("--goal") ??
  `Log in as "standard_user" / "secret_sauce", add the "Sauce Labs Backpack" to the cart, and complete checkout (First: Test, Last: User, Zip: 90210), reaching the order-complete confirmation.`;

run({ personas, runs, url, goal }).catch((err) => {
  console.error(err);
  process.exit(1);
});
