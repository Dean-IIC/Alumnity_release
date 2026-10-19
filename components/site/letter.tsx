import { paragraphsOf } from "../../lib/site-pages";

type LetterProps = {
  body: string;
  signerName: string | null;
  signerRole: string | null;
  /** Fold all but the first two paragraphs away (the About page); the desk's preview shows them all. */
  fold?: boolean;
};

/**
 * A letter from the college (the director's message): its greeting (the first paragraph),
 * the first two paragraphs, the rest a tap away, and who signed it. The About page and the
 * desk's preview draw it the same way.
 */
export function Letter({ body, signerName, signerRole, fold = true }: LetterProps) {
  const [greeting = "", ...paragraphs] = paragraphsOf(body);
  const shown = fold ? paragraphs.slice(0, 2) : paragraphs;
  const folded = fold ? paragraphs.slice(2) : [];
  return (
    <article className="letter" aria-labelledby="director">
      <p className="letter__from">A message from the {(signerRole || "college").toLowerCase()} · HKBK College of Engineering</p>
      <h2 id="director" className="letter__greeting">
        {greeting}
      </h2>
      {shown.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      {/* The rest folded away, so the page doesn't open on a wall of text; all of it a tap away. */}
      {folded.length > 0 && (
        <details className="letter__more">
          <summary>Read the full message</summary>
          {folded.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </details>
      )}
      {signerName && (
        <footer className="letter__sign">
          <strong>{signerName}</strong>
          {signerRole && <span>{signerRole}, HKBK College of Engineering</span>}
        </footer>
      )}
    </article>
  );
}
