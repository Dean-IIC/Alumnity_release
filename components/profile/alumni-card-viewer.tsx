"use client";

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
const SHARE_TEXT = "My HKBK College of Engineering alumni card, on Alumnity.";

export function AlumniCardViewer({ front, back, memberNo, profileUrl }: { front: ReactNode; back: ReactNode; memberNo: string; profileUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<Promise<File | null> | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const file = `alumnity-card-${memberNo.toLowerCase()}.png`;

  function open() {
    setFlipped(false);
    setNote("");
    dialog.current?.showModal();
    // Ready for Share (once per page; it's their own card, and it doesn't change while they look).
    image.current ??= fetch(CARD_URL, { credentials: "same-origin" })
      .then(async (r) => (r.ok ? new File([await r.blob()], file, { type: "image/png" }) : null))
      .catch(() => null);
  }

  async function share() {
    setNote("");
    try {
      const png = await image.current;
      if (png && navigator.canShare?.({ files: [png] })) {
        await navigator.share({ files: [png], title: "My alumni card", text: SHARE_TEXT });
        return;
      }
      await navigator.share({ title: "My alumni card", text: SHARE_TEXT, url: profileUrl });
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if ((error as Error)?.name === "AbortError") return;
      setNote("Sharing didn't work here. Download the card, or use the links below.");
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${profileUrl}`)}`;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;

  return (
    <>
      <button type="button" className="acard-promo__mini" onClick={open} tabIndex={-1} aria-hidden="true">
        <span className="acard-size">{front}</span>
      </button>
      <div className="acard-promo__text">
        <h2 id="alumni-card-title">Your alumni card</h2>
        <p>
          Your digital HKBK alumni card: your member number, and a code anyone can scan to find you on Alumnity. Show it at college events, or keep it on your
          phone.
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
            <h2 id="alumni-card-dialog-title">Your alumni card</h2>
            <button type="button" className="acard-dialog__close" onClick={() => dialog.current?.close()} aria-label="Close">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 3.5l9 9m0-9-9 9" />
              </svg>
            </button>
          </div>

          {/* A tap anywhere on the card turns it over; the button below does the same for keyboards. */}
          <div className="acard-size acard-flip" onClick={() => setFlipped((f) => !f)}>
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
              {flipped ? "See the front" : "Turn it over"}
            </button>
            <span className="acard-dialog__hint" aria-hidden="true">
              {" "}
              or tap the card
            </span>
          </p>

          <div className="acard-dialog__actions">
            <a className="button button--primary" href={`${CARD_URL}?download=1`} download={file}>
              Download
            </a>
            {canShare && (
              <button type="button" className="button button--secondary" onClick={share}>
                Share
              </button>
            )}
            <a className="acard-dialog__more" href={`${CARD_URL}?side=back&download=1`} download={file.replace(".png", "-back.png")}>
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
