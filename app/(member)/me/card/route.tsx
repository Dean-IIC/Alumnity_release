import { cardTheme } from "../../../../lib/alumni-card";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { signedInUser } from "../../../../lib/server/auth";
import { cardFor, cardPhoto, crestImage } from "../../../../lib/server/alumni-card";
import { CardBackImage, CardFrontImage, IMAGE_H, IMAGE_W } from "../../../../lib/server/alumni-card-image";

/*
 * /me/card: the signed-in member's own alumni card as a PNG, for "Download" and "Share" on
 * their page. There's no id in the address on purpose: it can only ever draw the card of
 * whoever is asking, so nobody can fetch someone else's. ?side=back for the back,
 * ?download=1 to save it rather than open it.
 *
 * No ".png" in the path: the middleware (which keeps sessions fresh) skips addresses
 * ending in an image extension, and this one needs the session.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await signedInUser();
  if (!user) return new NextResponse("Log in to see your alumni card.", { status: 401, headers: { "cache-control": "no-store" } });

  const url = new URL(request.url);
  const back = url.searchParams.get("side") === "back";
  // The design they chose on the page (only a known one; anything else is navy).
  const theme = cardTheme(url.searchParams.get("theme"));
  const card = await cardFor(user, url.origin);
  const [photo, crest] = await Promise.all([back ? null : cardPhoto(card.photoId, user.id), crestImage(url.origin)]);

  const file = `alumnity-card-${card.memberNo.toLowerCase()}${back ? "-back" : ""}.png`;
  return new ImageResponse(back ? <CardBackImage card={card} crest={crest} theme={theme} /> : <CardFrontImage card={card} photo={photo} crest={crest} theme={theme} />, {
    width: IMAGE_W,
    height: IMAGE_H,
    headers: {
      // Their own card, with their photo: never kept by a shared cache.
      "cache-control": "private, no-store",
      "content-disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename="${file}"`,
      "x-content-type-options": "nosniff"
    }
  });
}
