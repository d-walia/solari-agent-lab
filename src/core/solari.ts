/**
 * Solari client init + shared config. Grounded in the real cookbook SDK
 * (github.com/solari-sdk/solari-cookbook), not the docs.
 *
 * TWO gotchas the cookbook is emphatic about:
 *  1. `browser.close()` releases the SESSION. You must ALSO call
 *     `browsers.close()` ONCE at the very end of a run, or the Node process
 *     hangs forever (the client holds a loopback proxy that keeps the event
 *     loop alive). Every tool's run() does this in a top-level finally.
 *  2. Recording is opt-in per session (`recording: true` at launch). The replay
 *     uploads asynchronously AFTER release, so the first downloadReplay() calls
 *     404 — retry before concluding there's no replay.
 */
import "dotenv/config";
import { Solari } from "@solarisdk/browser";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} — copy .env.example to .env and fill it in.`);
  return v;
}

export const config = {
  solariKey: required("SOLARI_API_KEY"),
  anthropicKey: required("ANTHROPIC_API_KEY"),
  concurrency: (() => {
    const c = Math.floor(Number(process.env.MAX_CONCURRENCY ?? 8));
    return Number.isFinite(c) && c > 0 ? c : 8;
  })(),
  // The LLM that drives the browser agents. Haiku by default — the agents make
  // many calls, and the driving is mostly mechanical. Override with AGENT_MODEL
  // in .env (e.g. a stronger model for harder sites).
  agentModel: process.env.AGENT_MODEL ?? "claude-haiku-4-5-20251001",
  // Optional Cloudflare AI Gateway. When set, Anthropic calls route through the
  // gateway and carry the cf-aig-authorization header (authenticated gateways
  // 401 without it). Both are read from the shell env if exported there.
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || undefined,
  cfAigToken: process.env.CF_AIG_TOKEN || undefined,
};

/** One shared browser client for the whole run. Close it once, at the end. */
export const browsers = new Solari({ apiKey: config.solariKey });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Launch with retry + jitter. Running the pool at the concurrency cap means N
 * launches fire at once; if that bursts past the cap or a rate limit, the raw
 * launch() throws. Here we jitter the herd and back off so a trial waits for a
 * slot instead of dying. Surfaces the real error only after exhausting retries.
 */
export async function launchBrowser(opts?: Record<string, any>, tries = 4): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    if (i === 0) await sleep(Math.random() * 400);
    try {
      return await browsers.launch(opts as any);
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await sleep(2000 * (i + 1) + Math.random() * 800);
    }
  }
  throw lastErr;
}

/**
 * Best-effort replay fetch for forensics. Returns the rrweb NDJSON as a string,
 * or null if it never showed up. The client auto-decompresses — do not gunzip.
 */
export async function downloadReplay(sessionId: string, tries = 8): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    await sleep(3000);
    try {
      const blob = await (browsers as any).sessions.downloadReplay(sessionId);
      return blob.toString();
    } catch {
      // Usually a 404 because the replay hasn't uploaded yet; could be transient.
      // Retry regardless of the error shape (SDK error types aren't guaranteed),
      // and only give up after exhausting all tries.
    }
  }
  return null;
}
