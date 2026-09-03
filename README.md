# solari-agent-lab

Three small tools for the agentic era, all built on [Solari](https://getsolari.com) — real browsers, sandboxes, and desktops behind one API. Each one does something you can only do by running many real agents in parallel, which is the whole point.

| Tool | Question it answers | Subject |
| --- | --- | --- |
| **Gauntlet** ⚔️ | How reliably does my agent actually complete a task? | Your **agent** |
| **Slipstream** 💨 | Can AI agents actually get through my product's flows? | Your **product**, as seen by agents |
| **Swarm** 🐝 | Where do real users drop off in my funnel, and why? | Your product's **users** |

Same engine underneath — a bounded fan-out over Solari environments (`src/core/pool.ts`) and a shared report (`src/core/report.ts`). The tools differ only in what they run and how they score it.

## Why not just run this locally?

You can't. Each tool needs tens to thousands of real, isolated browser sessions at once — Gauntlet runs one task hundreds of times to get a reliability *distribution*, Swarm runs a swarm of personas at once, Slipstream runs agents through every flow. That's a fleet of cloud machines, not a laptop. Solari is the fleet.

## Setup

1. Get a Solari key at [console.getsolari.com](https://console.getsolari.com) (redeem a promo code for free credits).
2. `cp .env.example .env` and fill in `SOLARI_API_KEY`, `ANTHROPIC_API_KEY`, and `MAX_CONCURRENCY` (your plan's concurrency cap). The agents make many calls, so `AGENT_MODEL=claude-haiku-4-5-20251001` keeps it cheap. If your Anthropic calls route through a Cloudflare AI Gateway, set `ANTHROPIC_BASE_URL` and `CF_AIG_TOKEN` too.
3. Install and run:

```bash
npm install
```

```bash
npm run gauntlet -- --trials 10 --baseline   # reliability distribution + save the "before"
npm run slipstream -- --runs 8               # agent-readiness of the demo funnel
npm run swarm -- --runs 10 --success "dashboard"   # persona drop-off, completion verified by page text
```

Slipstream and Swarm default to the project's own flawed funnel (`demo-funnel/`, hosted on GitHub Pages). Point them at your own site instead:

```bash
npm run slipstream -- --url https://your.site --goal "sign up and reach the dashboard"
```

Each run saves the sessions of failed/blocked/drop-off attempts to `reports/*-sessions.json`. Fetch one's replay to see what the agent actually did:

```bash
npm run replay -- <sessionId>
```

## Status

- [x] Shared core — worker pool, agent driver, report writer
- [x] Gauntlet — reliability harness
- [x] Slipstream — agent-readiness
- [x] Swarm — synthetic users

Built with AI, fast, on purpose.
