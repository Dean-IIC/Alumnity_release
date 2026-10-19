import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../components/app/action-form";
import { addSamplesAction, removeSamplesAction } from "../../../lib/actions/dev";
import { isLocalDev } from "../../../lib/server/dev-only";
import { sampleCount } from "../../../lib/server/samples";
import { currentUser } from "../../../lib/server/session";
import "../../styles/wire.css";

/*
 * Development only: add or remove clearly made-up sample members, so every page has
 * someone on it while it's being built. Not part of the production site.
 */
export const dynamic = "force-dynamic";

export default async function DevSeed() {
  if (!(await isLocalDev())) notFound();
  const me = await currentUser();
  const count = await sampleCount();
  return (
    <main className="wf container">
      <header className="wf-head">
        <h1>Sample members (development only)</h1>
        <p className="wf-muted">
          Twelve made-up members, all named “… Sample”, with pages, a few connections, notes and an event. Nobody can log in as them. {me ? `Two of them will send you a connection request (${me.name}).` : "Log in first, and two of them will send you a connection request."}
        </p>
      </header>
      <p>
        <strong>{count}</strong> sample members now.
      </p>
      <div className="wf-actions">
        <ActionForm action={addSamplesAction}>
          <button className="button button--primary" type="submit" disabled={count > 0}>
            Add sample members
          </button>
        </ActionForm>
        <ActionForm action={removeSamplesAction} confirm="Remove every sample member and everything they made?">
          <button className="button button--secondary" type="submit" disabled={count === 0}>
            Remove sample members
          </button>
        </ActionForm>
      </div>
      <p style={{ marginTop: "var(--space-6)" }}>
        <Link href="/home">Go to Home →</Link>
      </p>
    </main>
  );
}
