/**
 * Solari client init + env config, shared by every tool.
 *
 * NOTE: SDK surface is per the Solari docs (docs.getsolari.com). Verify the
 * exact import/method names against your forked solari-cookbook before relying
 * on them — packages move faster than docs.
 */
import "dotenv/config";
import { Solari } from "@solarisdk/browser";
import { SandboxClient } from "@solarisdk/sandbox";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} — copy .env.example to .env and fill it in.`);
  return v;
}

export const config = {
  solariKey: required("SOLARI_API_KEY"),
  concurrency: Number(process.env.MAX_CONCURRENCY ?? 8),
};

/** Browser client — real Chrome in the cloud, driven with Playwright/CDP. */
export const browsers = new Solari({ apiKey: config.solariKey });

/** Sandbox client — headless Linux microVMs for code + checks. */
export const sandboxes = new SandboxClient({ apiKey: config.solariKey });
