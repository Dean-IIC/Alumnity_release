import Link from "next/link";

/**
 * "People you may know", once you've reached out to everyone in it: not an empty space,
 * a small celebration (confetti in the college's colours), and the next thing to do:
 * bring the rest of your batch in.
 */
export function KnowEveryone() {
  return (
    <section className="sheet side-box know-everyone" aria-labelledby="know-everyone">
      <span className="know-everyone__confetti" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </span>
      <p className="know-everyone__emoji" aria-hidden="true">
        🎉
      </p>
      <h2 id="know-everyone">You know everyone here!</h2>
      <p>We have no one else to show you right now. Invite your batch to join.</p>
      <Link className="button button--gold wf-small" href="/batch">
        Invite your batch
      </Link>
    </section>
  );
}
