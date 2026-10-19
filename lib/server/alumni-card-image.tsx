import type { ReactElement } from "react";
import { guillocheSvg, type AlumniCard } from "../alumni-card";
import { COLLEGE } from "../college";
import { qrModules, qrPath } from "../qr";

/*
 * The alumni card as an image, for "Download" and "Share": the same card as on the
 * member's page, laid out for next/og's ImageResponse (which draws a small subset of CSS:
 * flex boxes, gradients, absolute positions, images). Everything it shows comes from the
 * AlumniCard (lib/alumni-card.ts), which carries no USN or email by construction.
 *
 * 1200 × 757: a bank card's 85.6 × 54 mm, at about 356 dots per inch.
 */

export const IMAGE_W = 1200;
export const IMAGE_H = 757;

const NAVY = "#0a2a57";
const BLUE = "#123e7c";
const GOLD = "#ffb400";
const MARIGOLD = "#ee9b00";
const RED = "#e0242f";
const SOFT = "#c9d6ea";

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** The QR code as an SVG data URL: dark modules on white, with the standard's quiet zone. */
export function qrImage(link: string): string {
  const modules = qrModules(link);
  const n = modules.length + 8;
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 10}" height="${n * 10}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${qrPath(modules, 4)}" fill="${NAVY}"/></svg>`
  );
}

const frame = {
  width: IMAGE_W,
  height: IMAGE_H,
  display: "flex",
  position: "relative" as const,
  overflow: "hidden" as const,
  borderRadius: 44,
  color: "#fff",
  fontFamily: "Noto Sans, sans-serif",
  backgroundColor: NAVY,
  backgroundImage: `radial-gradient(circle at 85% 18%, rgba(255, 180, 0, 0.16), transparent 42%), linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 55%, ${NAVY} 100%)`
};

function Pattern() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={svgUrl(guillocheSvg())} width={IMAGE_W} height={IMAGE_H} alt="" style={{ position: "absolute", left: 0, top: 0 }} />;
}

/** The gold edge along the bottom, with a thin line of the college's red above it. */
function Edge() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 18, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 4, backgroundColor: RED, display: "flex" }} />
      <div style={{ height: 14, backgroundImage: `linear-gradient(90deg, ${MARIGOLD}, ${GOLD}, ${MARIGOLD})`, display: "flex" }} />
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", fontSize: 40, letterSpacing: -1, color: "#fff" }}>
      Alumnity<span style={{ color: GOLD }}>.</span>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <div style={{ display: "flex", fontSize: 17, letterSpacing: 4, color: GOLD, textTransform: "uppercase" }}>{children}</div>;
}

/** The card's frame in a chosen design (the default is the college's navy). */
const themed = (theme?: { dark: string; light: string }) =>
  theme
    ? { ...frame, backgroundColor: theme.dark, backgroundImage: `radial-gradient(circle at 85% 18%, rgba(255, 180, 0, 0.16), transparent 42%), linear-gradient(135deg, ${theme.dark} 0%, ${theme.light} 55%, ${theme.dark} 100%)` }
    : frame;

export function CardFrontImage({ card, photo, crest, theme }: { card: AlumniCard; photo: string | null; crest: string | null; theme?: { dark: string; light: string } }): ReactElement {
  const nameSize = card.name.length > 26 ? 42 : card.name.length > 20 ? 50 : 58;
  return (
    <div style={themed(theme)}>
      <Pattern />
      <Edge />
      <div style={{ display: "flex", flexDirection: "column", width: "100%", padding: "52px 64px 60px" }}>
        {/* The college: its crest and name, and Alumnity's own mark. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 104, height: 104, borderRadius: 52, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", border: `4px solid ${GOLD}` }}>
              {crest && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={crest} width={80} height={80} alt="" />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 26 }}>
              <div style={{ display: "flex", fontSize: 36, color: "#fff" }}>{COLLEGE.name}</div>
              <div style={{ display: "flex", fontSize: 21, letterSpacing: 6, color: GOLD, textTransform: "uppercase", marginTop: 4 }}>Alumnity card</div>
            </div>
          </div>
          <Wordmark />
        </div>

        {/* Who: photo (or initials), name, role, branch and batch. */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 50, flexGrow: 1 }}>
          <div style={{ display: "flex", width: 216, height: 216, borderRadius: 32, border: `5px solid ${GOLD}`, overflow: "hidden", backgroundColor: "#f5f7fa", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} width={206} height={206} alt="" style={{ objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", fontSize: 92, color: BLUE, letterSpacing: 2 }}>{card.initials}</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 46, maxWidth: 780 }}>
            <div style={{ display: "flex", fontSize: nameSize, lineHeight: 1.1, color: "#fff" }}>{card.name}</div>
            <div style={{ display: "flex", marginTop: 18 }}>
              <div style={{ display: "flex", padding: "6px 22px", borderRadius: 30, backgroundColor: GOLD, color: NAVY, fontSize: 24, letterSpacing: 3, textTransform: "uppercase" }}>{card.role}</div>
            </div>
            {card.department && <div style={{ display: "flex", fontSize: 27, color: SOFT, marginTop: 18 }}>{card.department}</div>}
            {card.batch && <div style={{ display: "flex", fontSize: 27, color: SOFT, marginTop: 4 }}>{card.batch}</div>}
          </div>
        </div>

        {/* The numbers, and the college's standing. */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Label>Member no.</Label>
              <div style={{ display: "flex", fontSize: 36, letterSpacing: 4, marginTop: 2 }}>{card.memberNo}</div>
            </div>
            {card.since && (
              <div style={{ display: "flex", flexDirection: "column", marginLeft: 56 }}>
                <Label>Member since</Label>
                <div style={{ display: "flex", fontSize: 36, letterSpacing: 2, marginTop: 2 }}>{String(card.since)}</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 19, color: SOFT, letterSpacing: 1 }}>Affiliated to VTU · Approved by AICTE</div>
        </div>
      </div>
    </div>
  );
}

export function CardBackImage({ card, crest, theme }: { card: AlumniCard; crest: string | null; theme?: { dark: string; light: string } }): ReactElement {
  return (
    <div style={themed(theme)}>
      <Pattern />
      <Edge />
      {/* A band across the top, where a plastic card has its stripe. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 64, height: 92, display: "flex", backgroundImage: "linear-gradient(90deg, #051730, #0b2347, #051730)" }} />
      <div style={{ display: "flex", flexDirection: "column", width: "100%", padding: "196px 64px 60px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", padding: 10, backgroundColor: "#fff", borderRadius: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImage(card.link)} width={250} height={250} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 50, maxWidth: 760 }}>
            <Label>Scan to check</Label>
            <div style={{ display: "flex", fontSize: 29, lineHeight: 1.35, marginTop: 12, color: "#fff" }}>
              {`${card.name} is a member of ${COLLEGE.name} on Alumnity.`}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: GOLD, marginTop: 18 }}>{card.shortLink}</div>
            <div style={{ display: "flex", fontSize: 22, color: SOFT, marginTop: 8, letterSpacing: 2 }}>{card.memberNo}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, color: GOLD }}>{`“${COLLEGE.motto}”`}</div>
            <div style={{ display: "flex", fontSize: 19, color: SOFT, marginTop: 8 }}>{`${COLLEGE.name} · Est. ${COLLEGE.established} · ${COLLEGE.place}`}</div>
            <div style={{ display: "flex", fontSize: 19, color: SOFT, marginTop: 2 }}>{`${COLLEGE.affiliation} · ${COLLEGE.approval}`}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {crest && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={crest} width={64} height={64} alt="" style={{ marginRight: 14 }} />
            )}
            <Wordmark />
          </div>
        </div>
      </div>
    </div>
  );
}
