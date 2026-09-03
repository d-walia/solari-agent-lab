/**
 * One configured Anthropic client for the whole lab.
 *
 * Routes through a Cloudflare AI Gateway when ANTHROPIC_BASE_URL + CF_AIG_TOKEN
 * are set — an authenticated gateway rejects calls that lack the
 * cf-aig-authorization header with a 401. With neither set, it hits the
 * Anthropic API directly. Import this everywhere instead of newing up a client.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./solari.js";

export const anthropic = new Anthropic({
  apiKey: config.anthropicKey,
  baseURL: config.anthropicBaseUrl,
  defaultHeaders: config.cfAigToken
    ? { "cf-aig-authorization": `Bearer ${config.cfAigToken}` }
    : undefined,
});

export const MODEL = config.agentModel;
