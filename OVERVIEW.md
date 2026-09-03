# What's built, by tool

A map of every piece in the repo, grouped by the tool it belongs to. All three tools run on one shared engine and differ only in what they steer the agent to do and how they score it.

---

## Shared core — `src/core/`

The engine every tool reuses.

| File | What it does |
| --- | --- |
| `agent.ts` | **The agent driver.** One LLM-steered loop over a Solari browser page: snapshot the page's interactable elements (tagged with `data-agent-idx`) plus its visible text → ask Claude for one action (click / type / navigate / scroll / finish / give_up) → execute it with Playwright → repeat until the goal is met, the agent gives up, or the step budget runs out. Handles SPAs (clears stale tags each snapshot), reads on-page text (not just buttons), and guards bad element indices. |
| `solari.ts` | Solari client + shared config (keys, concurrency cap, model). `launchBrowser()` adds retry + jitter so launches wait for a slot under the concurrency cap instead of dying. `downloadReplay()` fetches a session's rrweb replay. Reads an optional Cloudflare AI Gateway (`ANTHROPIC_BASE_URL` + `CF_AIG_TOKEN`). |
| `llm.ts` | One configured Anthropic client, gateway-aware (adds the `cf-aig-authorization` header when routing through a Cloudflare AI Gateway). Defaults to Haiku. |
| `pool.ts` | Bounded-concurrency worker pool — runs N jobs at a time (never more than the plan's cap), preserves order, and settles every job so one failure never loses a slot. |
| `report.ts` | Shared, theme-aware HTML report writer (`writeReport`, plus `kpi` / `bar` / `section` / `cluster` helpers). Escapes agent/LLM text so it can't garble the output. |

Plus two utilities:

- `src/debug.ts` — `npm run debug -- --url <url> --goal "<goal>"` drives one agent with the full trajectory streamed live. For diagnosing where an agent gets stuck.
- `src/replay.ts` — `npm run replay -- <sessionId>` downloads a session's replay NDJSON so you can see what the agent actually did.

---

## Gauntlet ⚔️ — agent reliability — `src/tools/gauntlet/`

*How reliably does my agent finish a task?* Runs the same task many times in parallel and reports a success-rate distribution + regressions.

| File | What it does |
| --- | --- |
| `suite.ts` | The tasks, run many times each. Targets `saucedemo.com` (a sanctioned automation playground) with easy → hard variants, including its intentionally-broken `problem_user` account. Each task has an unfakeable success check (reached the order-complete page). |
| `run.ts` | Fans each task out to K trials via the pool, collapses them into a per-task success rate + variance, diffs against a saved baseline (regression detection), and writes the report. Saves failed trials' session ids for replay. |
| `cli.ts` | `npm run gauntlet -- --trials 10 --baseline`. `--baseline` saves the run as the "before" to diff future runs against. |
| `debug.ts` | `npm run debug:gauntlet` — one checkout attempt with the live trajectory. |

**Output:** `reports/gauntlet.html` (per-task rates, variance, regression deltas) + `reports/gauntlet-failed-sessions.json`.

---

## Slipstream 💨 — agent-readiness — `src/tools/slipstream/`

*Can AI agents actually get through my product's flows?* Runs a plain agent through a flow and classifies why it gets blocked.

| File | What it does |
| --- | --- |
| `flows.ts` | The flows to attempt (defaults to the demo funnel) **and** the barrier classifier — sorts each failure into `access-block` / `auth-wall` / `ambiguity` / `timing` / `no-path` / `other`, each with a concrete fix hint. |
| `run.ts` | Runs a plain (non-persona) agent at each flow K times, scores how often it gets through, clusters the barriers, and writes the report. Saves blocked sessions for replay. |
| `cli.ts` | `npm run slipstream -- --runs 8` (default funnel), or `--url <url> --goal "<goal>"` for your own site. |

**Output:** `reports/slipstream.html` (agent-completion rate + top barriers with fixes) + `reports/slipstream-blocked-sessions.json`.

---

## Swarm 🐝 — synthetic users — `src/tools/swarm/`

*Where do real users drop off in my funnel, and why?* Sends persona-driven agents through a funnel and clusters the reasons the rest left.

| File | What it does |
| --- | --- |
| `personas.ts` | The synthetic users — five personas (impatient-mobile, skeptical-comparer, non-technical-firsttimer, returning-poweruser, distracted-multitasker). Each one's `patience` mechanically shortens its step budget, so impatient personas genuinely give up sooner. |
| `run.ts` | Sends each persona through the funnel N times, measures completion per persona, and clusters the **real give-up reasons** (step-exhaustion is counted separately, not treated as a "why"). Optional `--success` marker verifies completion by page text instead of the agent's self-report. Saves drop-off sessions for replay. |
| `cli.ts` | `npm run swarm -- --runs 10 --success "dashboard"` (default funnel), or `--url` / `--goal` for your own funnel. Enforces a 10-run minimum for a real sample. |

**Output:** `reports/swarm.html` (completion per persona + clustered "why they dropped off") + `reports/swarm-failed-sessions.json`.

---

## Demo target — `demo-funnel/`

`index.html` — a fictional "Nimbus" signup funnel, hosted on GitHub Pages, built to give Slipstream and Swarm real friction to find. Five deliberately planted flaws: buried/hover-only pricing, an icon-only continue button, a "promo code to continue" field that reads as required, a "Talk to sales" dead-end, and an ambiguously-labeled submit. The happy path is completable, so some agents/personas finish and some drop.
