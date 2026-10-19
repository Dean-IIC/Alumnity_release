import { alumniCard, CARD_H, CARD_W, guilloche, type AlumniCard, type CardPerson } from "../../lib/alumni-card";
import { COLLEGE } from "../../lib/college";
import { mediaUrl } from "../../lib/media-url";
import { qrModules, qrPath } from "../../lib/qr";
import { AlumniCardViewer } from "./alumni-card-viewer";

/*
 * The digital alumni card on a member's own page: a section that shows a small copy and
 * opens the full card (front and back, turned over with a tap), with Download and Share.
 * The two faces are drawn here, on the server; only the turning over, the dialog and the
 * sharing run in the browser (alumni-card-viewer.tsx). The PNG version is drawn by
 * /me/card from the same AlumniCard, so both say the same.
 *
 * Styles: app/styles/alumni-card.css (imported by the pages that show it).
 */

const PATTERN_ID = "acard-guilloche";

/** The gold linework, drawn once per page and reused by every face that shows it. */
function PatternDefs() {
  const { waves, rosette } = guilloche();
  return (
    <svg className="acard-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <symbol id={PATTERN_ID} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
          <path className="acard__waves" d={waves} />
          <path className="acard__rosette" d={rosette} />
        </symbol>
      </defs>
    </svg>
  );
}

function Pattern() {
  return (
    <svg className="acard__pattern" viewBox={`0 0 ${CARD_W} ${CARD_H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <use href={`#${PATTERN_ID}`} />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className="acard__brand">
      Alumnity<span className="acard__dot">.</span>
    </span>
  );
}

export function AlumniCardFront({ card }: { card: AlumniCard }) {
  const long = card.name.length > 26 ? "acard__name--longer" : card.name.length > 20 ? "acard__name--long" : "";
  return (
    <div className="acard acard--front">
      <Pattern />
      <span className="acard__edge" aria-hidden="true" />
      <div className="acard__top">
        <span className="acard__crest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/college/hkbk-logo.png" alt="" width={80} height={80} />
        </span>
        <span className="acard__college">
          <strong>{COLLEGE.name}</strong>
          <span>Alumni Network</span>
        </span>
        <Wordmark />
      </div>
      <div className="acard__who">
        <span className="acard__photo">
          {card.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(card.photoId, 160)} alt="" />
          ) : (
            <span className="acard__initials" aria-hidden="true">
              {card.initials}
            </span>
          )}
        </span>
        <div className="acard__details">
          <p className={`acard__name ${long}`}>{card.name}</p>
          <p>
            <span className="acard__role">{card.role}</span>
          </p>
          {card.department && <p className="acard__line">{card.department}</p>}
          {card.batch && <p className="acard__line">{card.batch}</p>}
        </div>
      </div>
      <div className="acard__foot">
        <dl className="acard__numbers">
          <div>
            <dt>Member no.</dt>
            <dd>{card.memberNo}</dd>
          </div>
          {card.since && (
            <div>
              <dt>Member since</dt>
              <dd>{card.since}</dd>
            </div>
          )}
        </dl>
        <p className="acard__standing">Affiliated to VTU · Approved by AICTE</p>
      </div>
    </div>
  );
}

export function AlumniCardBack({ card }: { card: AlumniCard }) {
  const modules = qrModules(card.link);
  const n = modules.length + 8;
  return (
    <div className="acard acard--back">
      <Pattern />
      <span className="acard__edge" aria-hidden="true" />
      <span className="acard__stripe" aria-hidden="true" />
      <div className="acard__verify">
        <svg className="acard__qr" viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${card.shortLink}`}>
          <rect width={n} height={n} fill="#fff" />
          <path d={qrPath(modules, 4)} fill="#0a2a57" />
        </svg>
        <div className="acard__verify-text">
          <p className="acard__label">Scan to verify</p>
          <p className="acard__statement">
            {card.name} is a member of {COLLEGE.name}&rsquo;s alumni network on Alumnity.
          </p>
          <p className="acard__link">{card.shortLink}</p>
          <p className="acard__number">{card.memberNo}</p>
        </div>
      </div>
      <div className="acard__foot acard__foot--back">
        <div>
          <p className="acard__motto">&ldquo;{COLLEGE.motto}&rdquo;</p>
          <p className="acard__fine">
            {COLLEGE.name} · Est. {COLLEGE.established} · {COLLEGE.place}
          </p>
          <p className="acard__fine">
            {COLLEGE.affiliation} · {COLLEGE.approval}
          </p>
        </div>
        <span className="acard__sign">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/college/hkbk-logo.png" alt="" width={64} height={64} />
          <Wordmark />
        </span>
      </div>
    </div>
  );
}

/** The section on /me: a small copy of the card, and the button that opens the whole thing. */
export function AlumniCardSection({ card }: { card: AlumniCard }) {
  return (
    <section className="acard-promo" id="alumni-card" aria-labelledby="alumni-card-title">
      <PatternDefs />
      <AlumniCardViewer
        front={<AlumniCardFront card={card} />}
        back={<AlumniCardBack card={card} />}
        memberNo={card.memberNo}
        profileUrl={card.link}
      />
    </section>
  );
}

/**
 * On someone else's page: a small "verified alumni card" mark. Only what their page already
 * shows (their role) and their member number, which comes from the id in the page's own
 * address; not the year they joined Alumnity, nor their photo again.
 */
export function AlumniCardBadge({ person }: { person: CardPerson }) {
  const card = alumniCard(person, { since: null, photoId: null, origin: "" });
  return (
    <p className="acard-badge">
      <span className="acard-badge__chip" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      </span>
      <span>
        <strong>Verified alumni card</strong>
        <span className="acard-badge__meta">
          {card.role} · {card.memberNo}
        </span>
      </span>
    </p>
  );
}
