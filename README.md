# solari-agent-lab

Three small tools for the agentic era, all built on [Solari](https://getsolari.com) — real browsers, sandboxes, and desktops behind one API. Each one does something you can only do by running many real agents in parallel, which is the whole point.

| Tool | Question it answers | Subject |
| --- | --- | --- |
| **Gauntlet** ⚔️ | How reliably does my agent actually complete a task? | Your **agent** |
| **Slipstream** 💨 | Can AI agents actually get through my product's flows? | Your **product**, as seen by agents |
| **Swarm** 🐝 | Where do real users drop off in my funnel, and why? | Your product's **users** |

Same engine underneath — a bounded fan-out over Solari environments (`src/core/pool.ts`) and a shared report (`src/core/report.ts`). The tools differ only in what they run and how they score it.

## Why not just run this locally?

You can't. Each tool needs tens to thousands of real, isolated browser/sandbox sessions at once — Gauntlet runs one task hundreds of times to get a reliability *distribution*, Swarm runs a swarm of personas at once, Errand runs multiple agent stacks across every flow. That's a fleet of cloud machines, not a laptop. Solari is the fleet.

## Setup

1. Get a Solari key at [console.getsolari.com](https://console.getsolari.com) (redeem a promo code for free credits).
2. `cp .env.example .env` and fill in `SOLARI_API_KEY`, `ANTHROPIC_API_KEY`, and `MAX_CONCURRENCY` (your plan's concurrency cap).
3. Install and run:

```bash
npm install
```

```bash
npm run gauntlet
```

## Status

- [x] Shared core — worker pool + report writer
- [ ] Gauntlet — reliability harness
- [ ] Slipstream — agent-readiness
- [ ] Swarm — synthetic users

Built with AI, fast, on purpose.
