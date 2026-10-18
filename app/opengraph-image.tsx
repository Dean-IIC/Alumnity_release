import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/*
 * The card WhatsApp, LinkedIn and the rest show when someone shares an Alumnity link (an
 * invitation, mostly): the name, what it is, and the campus in ink. Made once, at build.
 */
export const alt = "Alumnity: HKBK College of Engineering's students and alumni";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const asset = async (path: string, type: string) => `data:${type};base64,${(await readFile(join(process.cwd(), "public", path))).toString("base64")}`;

export default async function OpenGraphImage() {
  const [campus, crest] = await Promise.all([asset("assets/campus/hero/glass-block-sketch.jpg", "image/jpeg"), asset("assets/brand/hkbk-crest.png", "image/png")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f7f1e6", color: "#2b211b" }}>
        <div style={{ width: 640, padding: "72px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={crest} width={72} height={72} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 26, color: "#6b5a4c" }}>HKBK College of Engineering</span>
              <span style={{ fontSize: 22, color: "#8a7766" }}>Bengaluru · since 1997</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 96, fontWeight: 700, color: "#143f68", letterSpacing: -2 }}>alumnity.</span>
            <span style={{ fontSize: 40, lineHeight: 1.25, marginTop: 12 }}>Students and alumni: ask, guide and grow together.</span>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {[
              ["Ask a senior", "#a83932"],
              ["Jobs & referrals", "#2f6b45"],
              ["Your batch", "#c6842a"]
            ].map(([label, colour]) => (
              <span key={label} style={{ fontSize: 24, padding: "8px 18px", borderRadius: 999, border: `2px solid ${colour}`, color: colour }}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={campus} width={560} height={630} alt="" style={{ objectFit: "cover", width: "100%", height: "100%" }} />
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 120, background: "linear-gradient(90deg, #f7f1e6, rgba(247,241,230,0))" }} />
        </div>
      </div>
    ),
    size
  );
}
