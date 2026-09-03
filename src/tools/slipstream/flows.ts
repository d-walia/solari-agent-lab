/**
 * Slipstream flows + the failure classifier.
 *
 * A flow is a task a real agent-customer would try to complete on your site.
 * Slipstream runs a plain agent (no human persona) at each flow several times
 * and asks: can an agent actually get through? When it can't, the classifier
 * sorts *why* into agent-readiness categories with a concrete fix — the layer
 * the static "readiness score" scanners can't reach.
 *
 * The default flow points at saucedemo (a known-passable baseline). Point it at
 * your own site with:  npm run slipstream -- --url <url> --goal "<goal>"
 */
export interface Flow {
  id: string;
  label: string;
  url: string;
  goal: string;
}

export const flows: Flow[] = [
  {
    id: "saucedemo-checkout",
    label: "Checkout (baseline)",
    url: "https://www.saucedemo.com/",
    goal: `Log in as "standard_user" / "secret_sauce", add the "Sauce Labs Backpack" to the cart, and complete checkout (First: Test, Last: User, Zip: 90210). Finish at the order-complete page.`,
  },
];

export type Barrier =
  | "access-block"
  | "auth-wall"
  | "ambiguity"
  | "timing"
  | "no-path"
  | "other";

const HINTS: Record<Barrier, string> = {
  "access-block": "Bot detection / CAPTCHA is stopping legit agents. Allowlist known agent traffic or expose an API path.",
  "auth-wall": "A login/OTP step blocks the agent. Support delegated auth or an agent-friendly sign-in.",
  "ambiguity": "The agent couldn't identify the right control. Add clear labels / ARIA / stable selectors.",
  "timing": "Content loaded too slowly or async. Ensure key elements are present before they're needed.",
  "no-path": "No completable path for this task. Provide a direct route or an API for it.",
  "other": "Investigate the replay — the agent got stuck for a non-obvious reason.",
};

export function hintFor(b: Barrier): string {
  return HINTS[b];
}

/** Heuristic classifier over the give-up reason + the last page text. */
export function classify(reason: string | undefined, endText: string): Barrier {
  const s = `${reason ?? ""} ${endText}`.toLowerCase();
  if (/captcha|verify you are human|unusual traffic|are you a robot|access denied|forbidden|cloudflare|blocked/.test(s))
    return "access-block";
  if (/verification code|one-time|otp|two-factor|2fa|please (log|sign) in|enter your password/.test(s))
    return "auth-wall";
  if (/timeout|timed out|not ready|still loading|took too long/.test(s)) return "timing";
  if (/couldn'?t find|not listed|no (such )?element|ambiguous|unclear|couldn'?t tell|not sure which/.test(s))
    return "ambiguity";
  if (/no way to|can'?t be done|not possible|dead end|no path/.test(s)) return "no-path";
  return "other";
}
