"use client";

/*
 * "← Back": to the page you came from on Alumnity (as the browser's back would), or, if
 * you arrived here from elsewhere (a link in an email, a new tab), to `fallback`.
 */
export function BackLink({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  return (
    <a
      className="back-link"
      href={fallback}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        const fromHere = document.referrer && new URL(document.referrer).origin === window.location.origin && document.referrer !== window.location.href;
        if (fromHere && window.history.length > 1) {
          event.preventDefault();
          window.history.back();
        }
      }}
    >
      <span aria-hidden="true">←</span> {label}
    </a>
  );
}
