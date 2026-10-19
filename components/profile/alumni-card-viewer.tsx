"use client";

import { CARD_THEMES, cardTheme } from "../../lib/alumni-card";
import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * The browser's side of the alumni card (components/profile/alumni-card.tsx draws the
 * faces): the small copy that opens it, the dialog with the card that turns over on a tap
 * (or with the button, for keyboards and screen readers), and Download and Share.
 *
 * Share hands the card's PNG to the phone's own share sheet where it takes files (most
 * phones); otherwise the link to their page, or WhatsApp and LinkedIn links on a computer.
 * The PNG is fetched as the dialog opens, so the share sheet can open the moment Share is
 * pressed: browsers only allow it straight after a tap, not after a slow download.
 */

const CARD_URL = "/me/card";
const THEME_KEY = "alumnity:card-theme";
const SHARE_TEXT = "My Alumnity card from HKBK College of Engineering.";

export function AlumniCardViewer({ front, back, memberNo, profileUrl }: { front: ReactNode; back: ReactNode; memberNo: string; profileUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<Promise<File | null> | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [note, setNote] = useState("");
  // Their chosen design, remembered in this browser.
  const [theme, setTheme] = useState<string>(CARD_THEMES[0].key);

  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  useEffect(() => {
    try {
      setTheme(cardTheme(localStorage.getItem(THEME_KEY)).key);
    } catch {
      // Storage off: the college's navy.
    }
  }, []);

  function choose(key: string) {
    setTheme(key);
    image.current = null; // the shared image follows the new design
    try {
      localStorage.setItem(THEME_KEY, key);
    } catch {
      // Storage off: it's chosen for this visit.
    }
    prepare(key);
  }

  /** The card as a PNG, made ready for Share (in the chosen design). */
  function prepare(key: string) {
    image.current ??= fetch(`${CARD_URL}?theme=${key}`, { credentials: "same-origin" })
      .then(async (r) => (r.ok ? new File([await r.blob()], file, { type: "image/png" }) : null))
      .catch(() => null);
  }

  const file = `alumnity-card-${memberNo.toLowerCase()}.png`;

  function open() {
    setFlipped(false);
    setNote("");
    dialog.current?.showModal();
    // Ready for Share (once per design; it's their own card, and it doesn't change while they look).
    prepare(theme);
  }

  async function share() {
    setNote("");
    try {
      const png = await image.current;
      if (png && navigator.canShare?.({ files: [png] })) {
        await navigator.share({ files: [png], title: "My Alumnity card", text: SHARE_TEXT });
        return;
      }
      await navigator.share({ title: "My Alumnity card", text: SHARE_TEXT, url: profileUrl });
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if ((error as Error)?.name === "AbortError") return;
      setNote("Sharing did not work on this device. Download the card, or use the links below.");
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${profileUrl}`)}`;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;

  return (
    <>
      <button type="button" className="acard-promo__mini" onClick={open} tabIndex={-1} aria-hidden="true" data-card-theme={theme}>
        <span className="acard-size">{front}</span>
      </button>
      <div className="acard-promo__text">
        <h2 id="alumni-card-title">Your Alumnity card</h2>
        <p>
          Your digital Alumnity card. It shows your member number and a QR code that anyone can scan to find you on Alumnity. Show it at college
          events, or keep it on your phone.
        </p>
        <button type="button" className="button button--primary" onClick={open}>
          Open your card <span aria-hidden="true">→</span>
        </button>
      </div>

      {/* A click on the dimmed page around it (the dialog itself, not anything in it) closes it. */}
      <dialog
        ref={dialog}
        className="acard-dialog"
        aria-labelledby="alumni-card-dialog-title"
        onClose={() => setFlipped(false)}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      >
        <div className="acard-dialog__body">
          <div className="acard-dialog__head">
            <h2 id="alumni-card-dialog-title">Your Alumnity card</h2>
            <button type="button" className="acard-dialog__close" onClick={() => dialog.current?.close()} aria-label="Close">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 3.5l9 9m0-9-9 9" />
              </svg>
            </button>
          </div>

          {/* A tap anywhere on the card turns it over; the button below does the same for keyboards. */}
          <div className="acard-size acard-flip" data-card-theme={theme} onClick={() => setFlipped((f) => !f)}>
            <div className={`acard-flip__inner${flipped ? " is-flipped" : ""}`}>
              <div className="acard-flip__face" inert={flipped} aria-hidden={flipped}>
                {front}
              </div>
              <div className="acard-flip__face acard-flip__face--back" inert={!flipped} aria-hidden={!flipped}>
                {back}
              </div>
            </div>
          </div>

          <p className="acard-dialog__turn">
            <button type="button" className="wf-link-button" onClick={() => setFlipped((f) => !f)}>
              {flipped ? "See the front" : "See the back"}
            </button>
            <span className="acard-dialog__hint" aria-hidden="true">
              {" "}
              or tap the card
            </span>
          </p>

          {/* The card's design: one tap each, remembered for next time. */}
          <div className="acard-themes" role="radiogroup" aria-label="Card design">
            {CARD_THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={theme === t.key}
                aria-label={t.label}
                title={t.label}
                className="acard-themes__swatch"
                style={{ background: `linear-gradient(135deg, ${t.dark}, ${t.light})` }}
                onClick={() => choose(t.key)}
              />
            ))}
          </div>

          <div className="acard-dialog__actions">
            <a className="button button--primary" href={`${CARD_URL}?download=1&theme=${theme}`} download={file}>
              Download the front
            </a>
            {canShare && (
              <button type="button" className="button button--secondary" onClick={share}>
                Share
              </button>
            )}
            <a className="acard-dialog__more" href={`${CARD_URL}?side=back&download=1&theme=${theme}`} download={file.replace(".png", "-back.png")}>
              Download the back
            </a>
          </div>
          <p className="acard-dialog__links">
            <span>Share your page on</span>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a href={linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
          </p>
          <p className="acard-dialog__note" role="status">
            {note}
          </p>
        </div>
      </dialog>
    </>
  );
}
