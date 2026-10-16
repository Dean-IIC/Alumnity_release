import type { Metadata } from "next";
import { ActionForm } from "../../components/app/action-form";
import { AppPage } from "../../components/app/app-page";
import { PhotoField } from "../../components/causes/photo-field";
import { proposeCauseAction } from "../../lib/actions/causes";
import { timeAgo } from "../../lib/format";
import { CAUSE_LIMITS, causesFor, rupees, type Cause } from "../../lib/server/causes";
import { donationsOpen } from "../../lib/server/razorpay";
import { requireUser } from "../../lib/server/session";

export const metadata: Metadata = { title: "Causes · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS = { pending: "Waiting for the college desk", live: "Live", rejected: "Not approved", closed: "Closed" } as const;

function CauseLine({ cause }: { cause: Cause }) {
  const percent = Math.min(100, Math.round((cause.raised / cause.goal) * 100));
  return (
    <li className="wf-member">
      <div className="wf-member__who">
        <a className="wf-member__name" href={`/causes/${cause.id}`}>
          {cause.title}
        </a>
        <span className="wf-muted">
          {rupees(cause.raised)} of {rupees(cause.goal)} · {cause.supporters} {cause.supporters === 1 ? "supporter" : "supporters"}
          {cause.author ? ` · started by ${cause.author.name}` : ""}
        </span>
        <span className="cause-bar" role="img" aria-label={`${percent}% of the goal`}>
          <span style={{ width: `${percent}%` }} />
        </span>
      </div>
      <div className="wf-actions">{cause.status !== "live" && <span className="wf-tag">{STATUS[cause.status]}</span>}</div>
    </li>
  );
}

/** Causes members are giving to, your own, and proposing one. */
export default async function CausesPage() {
  const me = await requireUser("/causes");
  const { live, mine, past, waiting } = await causesFor(me);
  return (
    <AppPage user={me} current="causes" title="Causes" intro="Scholarships, a classmate in need, something for the college: give to what HKBK people care about.">
      {!donationsOpen() && <p className="wf-card">Giving opens once the college has set up payments. You can propose a cause now.</p>}

      {waiting.length > 0 && (
        <section className="wf-card" aria-labelledby="waiting">
          <h2 id="waiting">Waiting for the college desk ({waiting.length})</h2>
          <ul className="wf-list">
            {waiting.map((c) => (
              <li key={c.id} className="wf-member">
                <div className="wf-member__who">
                  <a className="wf-member__name" href={`/causes/${c.id}`}>
                    {c.title}
                  </a>
                  <span className="wf-muted">
                    Goal {rupees(c.goal)} · proposed {timeAgo(c.createdAt)}
                    {c.author ? ` by ${c.author.name}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>Live causes</h2>
      {live.length === 0 ? (
        <p className="wf-empty">No causes yet. Propose the first one below.</p>
      ) : (
        <ul className="wf-list">
          {live.map((c) => (
            <CauseLine key={c.id} cause={c} />
          ))}
        </ul>
      )}

      {mine.length > 0 && (
        <>
          <h2>Yours</h2>
          <ul className="wf-list">
            {mine.map((c) => (
              <CauseLine key={c.id} cause={c} />
            ))}
          </ul>
        </>
      )}

      <section aria-labelledby="propose">
        <h2 id="propose">Propose a cause</h2>
        <p className="wf-muted">
          The college desk reads every cause before it goes live, and may ask you about it. Donations go to HKBK College of Engineering's account; the college pays the cause and
          shows what it paid.
        </p>
        <ActionForm action={proposeCauseAction} className="wf-stack">
          <label className="field">
            <span className="field__label">Name</span>
            <input name="title" required minLength={5} maxLength={CAUSE_LIMITS.title} placeholder="e.g. Fees for two first-years from Shivajinagar" />
          </label>
          <label className="field">
            <span className="field__label">The story: who it helps, what the money is for, and who you are to it</span>
            <textarea name="story" required minLength={50} rows={7} maxLength={CAUSE_LIMITS.story} />
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Goal (₹)</span>
              <input name="goal" required inputMode="numeric" pattern="[0-9,]*" maxLength={12} placeholder="e.g. 1,50,000" />
            </label>
            <label className="field">
              <span className="field__label">Runs for</span>
              <select name="days" defaultValue="60">
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">6 months</option>
                <option value="0">Until it's closed</option>
              </select>
            </label>
          </div>
          <PhotoField />
          <div>
            <button className="button button--primary" type="submit">
              Send it to the college desk
            </button>
          </div>
        </ActionForm>
      </section>

      {past.length > 0 && (
        <>
          <h2>Past causes</h2>
          <ul className="wf-list">
            {past.map((c) => (
              <CauseLine key={c.id} cause={c} />
            ))}
          </ul>
        </>
      )}
    </AppPage>
  );
}
