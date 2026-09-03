/**
 * General debug runner — drive ONE agent at any url/goal with the full
 * trajectory streamed live. Use it to see where an agent gets stuck.
 *
 *   npm run debug -- --url <url> --goal "<goal>"
 */
import { browsers, launchBrowser } from "./core/solari.js";
import { drive } from "./core/agent.js";

const args = process.argv.slice(2);
const val = (flag: string, dflt: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};

const url = val("--url", "https://www.saucedemo.com/");
const goal = val("--goal", "Log in as standard_user / secret_sauce and reach the inventory page.");

console.log(`URL:  ${url}\nGoal: ${goal}\n=== TRAJECTORY (live) ===`);

const browser = await launchBrowser({ recording: true });
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  const res = await drive(page, {
    goal,
    onStep: (s) => {
      const fail = s.ok ? "" : `  [FAILED: ${s.note}]`;
      console.log(`${String(s.n).padStart(2)}. ${s.action}${s.target ? ` → ${s.target}` : ""}${fail}`);
      if (s.reasoning) console.log(`    ${s.reasoning}`);
    },
  });
  console.log("\n=== RESULT ===");
  console.log("final url :", page.url());
  console.log("succeeded :", res.succeeded);
  console.log("gaveUp    :", res.gaveUp, res.reason ? `(${res.reason})` : "");
} finally {
  await browser.close();
  await browsers.close();
}
