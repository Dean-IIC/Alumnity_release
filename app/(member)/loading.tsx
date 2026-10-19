/** While a page is being made: a pencil line drawing itself, so a tap always shows it was heard. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading__line" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
