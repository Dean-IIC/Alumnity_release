import type { Metadata } from "next";
import { Prose, PublicPage } from "../../components/public-page";
import { COMMUNITY } from "../../lib/about-content";

export const metadata: Metadata = { title: "Community · Alumnity", description: COMMUNITY.intro };

/** Who Alumnity is for, what's open to everyone, and what members get. */
export default function CommunityPage() {
  return (
    <PublicPage current="community" title="The alumni community" intro={COMMUNITY.intro}>
      <Prose text={COMMUNITY.body} />
    </PublicPage>
  );
}
