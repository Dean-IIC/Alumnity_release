import type { Metadata } from "next";
import { AppPage } from "../../../../components/app/app-page";
import { BackLink } from "../../../../components/back-link";
import { ProfileEditor } from "../../../../components/profile/profile-editor";
import { campusCover } from "../../../../components/profile/profile-sheet";
import { profileOf } from "../../../../lib/server/profile";
import { requireUser } from "../../../../lib/server/session";
import "../../../styles/join.css";
import "../../../styles/profile.css";

export const metadata: Metadata = { title: "Edit your page · Alumnity", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function EditPage() {
  const user = await requireUser("/me/edit");
  return (
    <AppPage user={user} current="me" bare>
      <div className="profile-page">
        <header className="page-head">
          <BackLink fallback="/me" label="Your page" />
          <h1 className="page-title">Edit your page</h1>
          <p className="page-head__text">You can skip any part. For each part, choose who can see it.</p>
        </header>
        <ProfileEditor initial={await profileOf(user.id)} role={user.role} name={user.name} campus={campusCover(user)} seed={user.id} />
      </div>
    </AppPage>
  );
}
