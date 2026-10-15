import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { SiteFooter } from "../../../components/site-footer";
import { ProfileEditor } from "../../../components/profile/profile-editor";
import { profileOf } from "../../../lib/server/profile";
import { currentUser } from "../../../lib/server/session";
import "../../styles/join.css";
import "../../styles/profile.css";

export const metadata: Metadata = { title: "Edit your page · Alumnity", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function EditPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/me/edit");
  return (
    <>
      <SiteHeader />
      <main className="profile-page container">
        <header className="page-head">
          <a className="back-link" href="/me">
            <span aria-hidden="true">←</span> Your page
          </a>
          <h1 className="page-title">Edit your page</h1>
          <p className="page-head__text">Everything here is optional. For each part, choose who can see it.</p>
        </header>
        <ProfileEditor initial={await profileOf(user.id)} />
      </main>
      <SiteFooter />
    </>
  );
}
