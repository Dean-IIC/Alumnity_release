import { strengthLevel, type Strength } from "../../lib/profile-strength";
import { StrengthBar } from "./strength-bar";
import "../../app/styles/strength.css";

/*
 * "Profile strength", shown only to the page's owner (on /me, and on Home while it's not
 * full): a bar with the percentage, a word for it, and the next few things to add, each
 * a link to the field that fills it and what it adds. Full, it shrinks to one green line.
 * Worked out by lib/profile-strength.ts.
 */
export function ProfileStrength({
  strength,
  show = 3,
  skip = [],
  heading = "h2",
  className = ""
}: {
  strength: Strength;
  /** How many of the missing items to suggest. */
  show?: number;
  /** Items said elsewhere on the page (Home's "Getting started"), not suggested twice. */
  skip?: string[];
  heading?: "h2" | "h3";
  className?: string;
}) {
  const { percent } = strength;
  const level = strengthLevel(percent);
  const Heading = heading;

  if (percent >= 100) {
    return (
      <section className={`strength strength--complete ${className}`.trim()} aria-label="Profile strength">
        <p className="strength__done">
          <span className="strength__tick" aria-hidden="true">
            ✓
          </span>
          Your profile is complete
          <span className="strength__percent">100%</span>
        </p>
        <StrengthBar percent={100} label={level} complete />
      </section>
    );
  }

  const next = strength.missing.filter((m) => !skip.includes(m.key)).slice(0, show);
  return (
    <section className={`strength ${className}`.trim()} aria-labelledby="strength-title">
      <div className="strength__head">
        <Heading id="strength-title" className="strength__title">
          Profile strength
        </Heading>
        <span className={`strength__level strength__level--${level === "Getting started" ? "low" : level === "Good" ? "mid" : "high"}`}>{level}</span>
        <span className="strength__percent">{percent}%</span>
      </div>
      <StrengthBar percent={percent} label={level} complete={false} />
      {next.length > 0 && (
        <ul className="strength__next" aria-label="What's left">
          {next.map((m) => (
            <li key={m.key}>
              <a href={m.href}>
                {m.label}
                <span className="strength__gain">+{m.weight}%</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
