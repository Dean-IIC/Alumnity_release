// Records the intro's heavy part (the eras, the ink line, the pull-back) as a video, frame
// by frame, so phones can play it with their video hardware instead of drawing it live.
// The patterns, the wordmark and the reveal stay live in the page (they're cheap).
//
//   1. Serve the site (a production build is best): NEXT_DIST_DIR=.next-prod next start -p 3005
//   2. Start a headless Chromium with --remote-debugging-port=9333
//   3. node scripts/record-intro.mjs --width 360 --height 780 --dpr 3 --out public/assets/intro/phone
//      node scripts/record-intro.mjs --width 1280 --height 720 --dpr 1.5 --deliver 1280 --out public/assets/intro/wide
//      node scripts/record-intro.mjs --width 768 --height 1024 --dpr 2 --deliver 900 --out public/assets/intro/tablet
//
// Writes <out>-<deliver>.hevc.mp4 and <out>-<deliver>.h264.mp4 (what the site plays; 720
// wide unless --deliver says otherwise) and a full-size master. Needs ffmpeg on the PATH
// (or FFMPEG=…).

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const SITE = arg("site", "http://localhost:3005");
const CDP = arg("cdp", "http://127.0.0.1:9333");
const WIDTH = Number(arg("width", 360));
const HEIGHT = Number(arg("height", 780));
const DPR = Number(arg("dpr", 3));
const FPS = Number(arg("fps", 30));
/** Where the video hands over to the live page: once every era has shrunk away (WORLD_GONE). */
const END_MS = Number(arg("end", 16720));
const OUT = arg("out", "public/assets/intro/phone");
/** How wide the videos the site plays are, in pixels. */
const DELIVER = Number(arg("deliver", 720));
const FFMPEG = process.env.FFMPEG || "ffmpeg";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tab = await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((ok) => (ws.onopen = ok));
let n = 0;
const waiting = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
};
const send = (method, params = {}) => new Promise((ok) => { const id = ++n; waiting.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: DPR, mobile: true });
await send("Page.navigate", { url: `${SITE}/?intro=1&t=0&capture=1` });

// Wait for every era's photos and the fonts, so no frame is caught half-loaded.
for (let i = 0; i < 120; i++) {
  await sleep(500);
  if (await evaluate("Boolean(window.__introReady && window.__introAt) && document.fonts.status === 'loaded'")) break;
  if (i === 119) throw new Error("The intro never became ready: is the site running?");
}
// The live parts and the controls aren't in the video.
await evaluate(`(() => { const s = document.createElement("style"); s.textContent = ".ink-intro__controls,.side-patterns-host,.intro-lockup,.soon-notice,nextjs-portal{display:none!important}"; document.head.appendChild(s); })()`);
await evaluate("window.__introAt(0)");
await sleep(400);

mkdirSync(dirname(OUT), { recursive: true });
const pixelsWide = WIDTH * DPR;
// One pass, three files: H.265 and H.264 at 720 wide (what phones get: H.265 where it
// plays, H.264 elsewhere), and a full-sharpness H.265 master for later. Colour is converted
// to the standard ("TV") range: some Android players show full-range video washed out.
const range = "scale=in_range=pc:out_range=tv,format=yuv420p";
const small = `${range},scale=${DELIVER}:-2:flags=lanczos`;
const ffmpeg = spawn(
  FFMPEG,
  [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-filter_complex", `[0:v]split=3[a][b][c];[a]${small}[hevc];[b]${small}[h264];[c]${range}[master]`,
    "-map", "[hevc]", "-c:v", "libx265", "-preset", "slow", "-crf", "27", "-tag:v", "hvc1", "-movflags", "+faststart", "-an", `${OUT}-${DELIVER}.hevc.mp4`,
    "-map", "[h264]", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high", "-movflags", "+faststart", "-an", `${OUT}-${DELIVER}.h264.mp4`,
    "-map", "[master]", "-c:v", "libx265", "-preset", "slow", "-crf", "24", "-tag:v", "hvc1", "-movflags", "+faststart", "-an", `${OUT}-${pixelsWide}.master.mp4`
  ],
  { stdio: ["pipe", "inherit", "inherit"] }
);
const done = new Promise((ok, fail) => ffmpeg.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`)))));

const frames = Math.round((END_MS / 1000) * FPS);
const started = Date.now();
for (let f = 0; f <= frames; f++) {
  await evaluate(`window.__introAt(${((f * 1000) / FPS).toFixed(3)})`);
  const { result } = await send("Page.captureScreenshot", { format: "jpeg", quality: 95, optimizeForSpeed: false });
  const ok = ffmpeg.stdin.write(Buffer.from(result.data, "base64"));
  if (!ok) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  if (f % 60 === 0) process.stdout.write(`\r${f}/${frames} frames, ${Math.round((Date.now() - started) / 1000)} s`);
}
ffmpeg.stdin.end();
await done;
console.log(`\nWrote ${OUT}-${DELIVER}.hevc.mp4, ${OUT}-${DELIVER}.h264.mp4 and ${OUT}-${pixelsWide}.master.mp4`);
await fetch(`${CDP}/json/close/${tab.id}`);
ws.close();
