/**
 * The agent driver — one LLM-steered loop over a Solari browser page.
 *
 * Every tool reuses this: Gauntlet runs it many times to measure reliability,
 * Slipstream runs it to see where agents get stuck, Swarm runs it as different
 * personas. The only differences are the goal, the optional persona steering,
 * and the step budget.
 *
 * The loop each step: snapshot the page's interactable elements → ask the model
 * for one action → execute it with Playwright → record it. Stops on finish,
 * give_up, or the step budget.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./solari.js";
import { anthropic } from "./llm.js";

export interface Persona {
  name: string;
  /** One or two sentences of who they are and what they're trying to do. */
  context: string;
  /** 0 (bails at the first friction) … 1 (very persistent). Scales the budget. */
  patience: number;
}

export interface Step {
  n: number;
  action: string;
  target?: string;
  reasoning: string;
  ok: boolean;
  note?: string;
}

export interface DriveResult {
  succeeded: boolean;
  gaveUp: boolean;
  reason?: string;
  steps: Step[];
}

const ACT_TOOL: Anthropic.Tool = {
  name: "act",
  description: "Take exactly one action toward the goal on the current page.",
  input_schema: {
    type: "object",
    properties: {
      reasoning: { type: "string", description: "One sentence: why this action, in the persona's voice if given." },
      action: { type: "string", enum: ["click", "type", "navigate", "scroll", "finish", "give_up"] },
      index: { type: "number", description: "Element index for click/type." },
      text: { type: "string", description: "Text to type (for type)." },
      url: { type: "string", description: "URL for navigate." },
      success: { type: "boolean", description: "For finish: did you actually achieve the goal?" },
    },
    required: ["reasoning", "action"],
  },
};

/** Tag interactable, visible elements with data-agent-idx and return a compact list. */
async function snapshot(page: any): Promise<Array<{ idx: number; label: string }>> {
  return await page.evaluate(() => {
    const sel = 'a,button,input,textarea,select,[role="button"],[role="link"],[onclick]';
    const out: Array<{ idx: number; label: string }> = [];
    let i = 0;
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      if (!visible) return;
      el.setAttribute("data-agent-idx", String(i));
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") ?? "").trim();
      const id = el.id ? `#${el.id}` : "";
      const isField = (tag === "input" && type !== "submit" && type !== "button") || tag === "textarea";
      const val = String((el as HTMLInputElement).value ?? "");
      const name =
        (el.getAttribute("aria-label") ||
          (el as HTMLInputElement).placeholder ||
          el.innerText ||
          (isField ? "" : val) ||
          el.getAttribute("name") ||
          "").trim().replace(/\s+/g, " ").slice(0, 60);
      const state = isField ? (val ? ` filled:"${val.slice(0, 24)}"` : " empty") : "";
      out.push({ idx: i, label: `${tag}${type ? `[${type}]` : ""}${id} "${name}"${state}` });
      i++;
    });
    return out;
  });
}

function systemPrompt(goal: string, persona?: Persona): string {
  const who = persona
    ? `You are role-playing a real user, not a QA bot. Persona: ${persona.name}. ${persona.context} Behave like them — their patience, savviness, and what they'd notice or ignore. If friction exceeds what this person would tolerate, use give_up and say why in their voice.`
    : `You are an autonomous agent trying to complete a task on a website on a user's behalf, the way a real AI agent would.`;
  return `${who}

Your goal: ${goal}

Each turn you get the current URL and a numbered list of interactable elements. Call the "act" tool with exactly one action. Rules:
- click/type take an element "index" from the list. type also needs "text".
- Only "finish" when the goal is genuinely complete; set success truthfully.
- Use "give_up" if you're blocked, confused, or (as a persona) too frustrated to continue — explain why.
- Don't invent elements; if what you need isn't listed, scroll or navigate.`;
}

export async function drive(
  page: any,
  opts: { goal: string; persona?: Persona; maxSteps?: number; onStep?: (s: Step) => void },
): Promise<DriveResult> {
  const budget = opts.maxSteps ?? (opts.persona ? Math.round(8 + opts.persona.patience * 16) : 24);
  const steps: Step[] = [];
  const emit = (s: Step) => {
    steps[steps.length] = s;
    opts.onStep?.(s);
  };
  const history: string[] = [];

  for (let n = 1; n <= budget; n++) {
    let url = "";
    let elements: Array<{ idx: number; label: string }> = [];
    try {
      url = page.url();
      elements = await snapshot(page);
    } catch {
      /* page mid-navigation; try again next loop */
    }

    const list = elements.map((e) => `  [${e.idx}] ${e.label}`).join("\n") || "  (none found)";
    const recent = history.slice(-6).join("\n") || "  (nothing yet)";

    let msg: Anthropic.Message;
    try {
      msg = await anthropic.messages.create({
        model: config.agentModel,
        max_tokens: 512,
        tools: [ACT_TOOL],
        tool_choice: { type: "tool", name: "act" },
        system: systemPrompt(opts.goal, opts.persona),
        messages: [
          {
            role: "user",
            content: `URL: ${url}\n\nElements:\n${list}\n\nRecent actions:\n${recent}\n\nWhat's your next action?`,
          },
        ],
      });
    } catch (err: any) {
      const note = String(err?.message ?? err);
      emit({ n, action: "model_error", reasoning: "", ok: false, note });
      return { succeeded: false, gaveUp: false, reason: `model error: ${note}`, steps };
    }

    const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (!call) {
      emit({ n, action: "no_action", reasoning: "", ok: false, note: "model returned no tool call" });
      return { succeeded: false, gaveUp: false, reason: "model returned no tool call", steps };
    }
    const a = call.input as any;
    const target = elements.find((e) => e.idx === a.index)?.label;

    if (a.action === "finish") {
      emit({ n, action: "finish", reasoning: a.reasoning, ok: true });
      return { succeeded: Boolean(a.success), gaveUp: false, steps };
    }
    if (a.action === "give_up") {
      emit({ n, action: "give_up", reasoning: a.reasoning, ok: true, note: a.reasoning });
      return { succeeded: false, gaveUp: true, reason: a.reasoning, steps };
    }

    // Execute the action.
    let ok = true;
    let note: string | undefined;
    try {
      const byIdx = (i: number) => `[data-agent-idx="${i}"]`;
      if (a.action === "click") {
        await page.click(byIdx(a.index), { timeout: 8000 });
      } else if (a.action === "type") {
        await page.fill(byIdx(a.index), String(a.text ?? ""), { timeout: 8000 });
      } else if (a.action === "navigate") {
        await page.goto(a.url, { waitUntil: "domcontentloaded", timeout: 20000 });
      } else if (a.action === "scroll") {
        await page.mouse.wheel(0, 700);
      }
      await page.waitForTimeout(600);
    } catch (err: any) {
      ok = false;
      note = String(err?.message ?? err).slice(0, 120);
    }

    emit({ n, action: a.action, target, reasoning: a.reasoning, ok, note });
    history.push(`${n}. ${a.action}${target ? ` ${target}` : ""}${a.url ? ` ${a.url}` : ""}${ok ? "" : ` (FAILED: ${note})`}`);
  }

  return { succeeded: false, gaveUp: false, reason: `ran out of steps (${budget})`, steps };
}
