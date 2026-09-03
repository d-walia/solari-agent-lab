/**
 * Shared HTML report writer. Every tool produces a report.html; this gives them
 * one consistent, theme-aware shell so the three outputs read as a set.
 */
import { writeFile } from "node:fs/promises";

const SHELL = (title: string, accent: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
  :root{--ground:#f4f6f8;--surface:#fff;--surface2:#eef0f3;--ink:#15181c;--soft:#4a4e55;--muted:#767c85;--border:#e0e4ea;--accent:${accent};--fail:#cb3a33;}
  @media(prefers-color-scheme:dark){:root{--ground:#0e1013;--surface:#15181c;--surface2:#1c2025;--ink:#eceef1;--soft:#b3b8bf;--muted:#828892;--border:#262b31;--fail:#f0655d;}}
  *{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.6 "IBM Plex Sans",system-ui,sans-serif}
  .wrap{max-width:940px;margin:0 auto;padding:40px 24px}
  h1{font-family:"Bricolage Grotesque",sans-serif;font-size:2rem;letter-spacing:-.02em;margin:0 0 4px}
  .sub{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:28px}
  .kpis{display:flex;flex-wrap:wrap;gap:26px;margin:0 0 30px}
  .kpi .v{font-family:"Bricolage Grotesque",sans-serif;font-size:2rem;font-weight:600;font-variant-numeric:tabular-nums;line-height:1}
  .kpi .k{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  .row{display:grid;grid-template-columns:1fr 90px 150px;align-items:center;gap:14px;padding:11px 0;border-top:1px solid var(--border)}
  .row .name small{display:block;font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--muted)}
  .rate{font-family:"IBM Plex Mono",monospace;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
  .bar{height:8px;border-radius:100px;background:var(--surface2);overflow:hidden}
  .bar>span{display:block;height:100%;border-radius:100px;background:var(--accent)}
  .seclabel{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:34px 0 12px}
  .cluster{display:flex;gap:12px;align-items:baseline;padding:12px 14px;background:var(--surface2);border-radius:9px;margin-bottom:8px}
  .cluster .c{font-family:"IBM Plex Mono",monospace;font-weight:600;color:var(--fail);white-space:nowrap}
  .cluster .t em{color:var(--soft);font-style:italic}
  a{color:var(--accent)}
</style></head><body><div class="wrap">${body}</div></body></html>`;

export function kpi(v: string, k: string): string {
  return `<div class="kpi"><div class="v">${v}</div><div class="k">${k}</div></div>`;
}

export function bar(name: string, sub: string, pct: number, replayUrl?: string): string {
  const link = replayUrl ? ` <a href="${replayUrl}">replay ↗</a>` : "";
  return `<div class="row"><div class="name">${name}<small>${sub}${link}</small></div>` +
    `<div class="rate">${pct}%</div><div class="bar"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div></div>`;
}

/** A section heading inside the report body. */
export function section(label: string): string {
  return `<div class="seclabel">${label}</div>`;
}

/** A clustered-reason line: a count and the reason (wrap verbatim quotes in <em>). */
export function cluster(count: number, text: string): string {
  return `<div class="cluster"><span class="c">×${count}</span><span class="t">${text}</span></div>`;
}

export async function writeReport(
  path: string,
  opts: { title: string; subtitle: string; accent?: string; kpis: string[]; rows: string[]; extra?: string },
): Promise<void> {
  const body =
    `<h1>${opts.title}</h1><div class="sub">${opts.subtitle}</div>` +
    `<div class="kpis">${opts.kpis.join("")}</div>` +
    opts.rows.join("") +
    (opts.extra ?? "");
  await writeFile(path, SHELL(opts.title, opts.accent ?? "#db4e1b", body), "utf8");
}
