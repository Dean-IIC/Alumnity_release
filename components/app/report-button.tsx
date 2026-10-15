/**
 * "Report": a plain link to the report page (one form there), rather than a hidden form
 * under every note and comment, which made busy pages heavy. It comes back here after.
 */
export function ReportButton({ kind, id, label = "Report", back }: { kind: "member" | "post" | "comment" | "message" | "ask"; id: number; label?: string; back?: string }) {
  const params = new URLSearchParams({ kind, id: String(id), ...(back ? { back } : {}) });
  return (
    <a className="wf-link-button" href={`/report?${params}`} rel="nofollow">
      {label}
    </a>
  );
}
