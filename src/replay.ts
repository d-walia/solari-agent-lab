/**
 * replay — download a Solari session replay by id and save the rrweb NDJSON.
 * The runs write failed session ids to reports/<tool>-failed-sessions.json;
 * this fetches one so you can inspect what the agent actually did.
 *
 *   npm run replay -- <sessionId> [outfile]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { browsers, downloadReplay } from "./core/solari.js";

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("usage: npm run replay -- <sessionId> [outfile]");
  process.exit(1);
}
const out = process.argv[3] ?? `reports/replays/${sessionId}.ndjson`;

try {
  await mkdir("reports/replays", { recursive: true });
  console.log(`fetching replay for ${sessionId}…`);
  const ndjson = await downloadReplay(sessionId);
  if (!ndjson) {
    console.error("no replay found — the session may not have had recording:true, or it hasn't uploaded yet.");
    process.exit(1);
  }
  await writeFile(out, ndjson);
  console.log(`saved → ${out} (${ndjson.length} bytes of rrweb NDJSON)`);
} finally {
  await browsers.close();
}
