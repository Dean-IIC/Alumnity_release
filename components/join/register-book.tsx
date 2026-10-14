import type { CSSProperties } from "react";

/*
 * The college register, drawn: a ruled page of the old book, its lines in faint pencil.
 * Looking someone up riffles through its pages; when they're found, the pen writes their line in,
 * the register's red stamp lands on it, and a gust of wind carries a few leaves across.
 * Motion is all CSS (app/styles/join.css), and still for reduced motion.
 */

export type BookState = "idle" | "searching" | "found" | "not-found";

export type BookLine = { name: string; usn: string; branch: string; joined: number };

const ROWS = 9;
/** The found line is written on this row. */
const YOURS = 5;

/** A pencil scribble standing in for a name nobody can read: wobbly, a different length each row. */
function scribble(row: number, from: number, to: number) {
  const y = 12;
  let d = `M${from} ${y}`;
  for (let x = from, i = 0; x < to; x += 9, i++) {
    const up = (row * 7 + i * 13) % 5;
    d += `q4.5 ${-(3 + up)} 9 0`;
  }
  return d;
}

const WIDTHS = [150, 118, 170, 132, 160, 104, 146, 124, 166];

export function RegisterBook({ state, line }: { state: BookState; line?: BookLine }) {
  return (
    <figure className={`register-book register-book--${state}`} aria-hidden="true">
      <div className="register-book__page">
        <header className="register-book__head">
          <span className="register-book__title">HKBK College of Engineering</span>
          <span className="register-book__sub">Register of students · since 1998</span>
        </header>
        <div className="register-book__columns">
          <span>USN</span>
          <span>Name</span>
          <span>Branch</span>
          <span>Joined</span>
        </div>
        <ol className="register-book__rows">
          {Array.from({ length: ROWS }, (_, row) => (
            <li key={row} className={row === YOURS ? "register-book__row register-book__row--yours" : "register-book__row"} style={{ "--row": row } as CSSProperties}>
              {row === YOURS && state === "found" && line ? (
                <span className="register-book__written">
                  <span>{line.usn}</span>
                  <span>{line.name}</span>
                  <span>{line.branch}</span>
                  <span>{line.joined}</span>
                </span>
              ) : (
                <svg viewBox="0 0 340 24" preserveAspectRatio="none">
                  <path d={scribble(row, 6, 60)} />
                  <path d={scribble(row + 3, 76, 76 + WIDTHS[row])} />
                  <path d={scribble(row + 5, 262, 292)} />
                  <path d={scribble(row + 1, 306, 334)} />
                </svg>
              )}
              {/* The register's stamp, inked on the found line. */}
              {row === YOURS && (
                <svg className="register-book__stamp" viewBox="0 0 120 120">
                  <defs>
                    <path id="stamp-ring" d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1 -82 0" />
                  </defs>
                  <circle cx="60" cy="60" r="54" />
                  <circle cx="60" cy="60" r="31" />
                  <text>
                    <textPath href="#stamp-ring" startOffset="2%">ON THE REGISTER · HKBK CE ·</textPath>
                  </text>
                  <text x="60" y="66" textAnchor="middle" className="register-book__stamp-mark">✓</text>
                </svg>
              )}
            </li>
          ))}
        </ol>
        {/* Not found: the register's other stamp, in brown ink across the page. */}
        <svg className="register-book__seal" viewBox="0 0 160 160">
          <defs>
            <path id="seal-ring" d="M80 80m-58 0a58 58 0 1 1 116 0a58 58 0 1 1 -116 0" />
          </defs>
          <circle cx="80" cy="80" r="72" />
          <circle cx="80" cy="80" r="66" className="register-book__seal-dash" />
          <circle cx="80" cy="80" r="44" />
          <text>
            <textPath href="#seal-ring" startOffset="1%">NOT FOUND ON THE REGISTER · HKBK CE ·</textPath>
          </text>
          <text x="80" y="76" textAnchor="middle" className="register-book__seal-mark">?</text>
          <text x="80" y="98" textAnchor="middle" className="register-book__seal-note">CHECK &amp; TRY AGAIN</text>
        </svg>
        {/* Looking you up: leaves of the register lift and turn over at the spine, one after another. */}
        <div className="register-book__flips">
          {[0, 1, 2].map((f) => (
            <span key={f} className="register-book__flip" style={{ "--f": f } as CSSProperties} />
          ))}
        </div>
      </div>
      {/* A gust of wind when you're found: a few leaves carried across the page. */}
      <div className="register-book__wind">
        {[0, 1, 2, 3, 4].map((i) => (
          <svg key={i} className="register-book__leaf" viewBox="-4 -24 78 32" style={{ "--i": i } as CSSProperties}>
            <path d="M0 0c18 -22 52 -24 70 -6c-20 20 -52 22 -70 6zM0 0l58 -8" />
          </svg>
        ))}
      </div>
    </figure>
  );
}
