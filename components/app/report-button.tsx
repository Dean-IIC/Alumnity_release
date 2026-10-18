import Link from "next/link";
/**
 * "Report": a plain link to the report page (one form there), rather than a hidden form
 * under every note and comment, which made busy pages heavy. It comes back here after.
 */
import type { SubjectKind } from "../../lib/server/desk";

export function ReportButton({ kind, id, label = "Report", back }: { kind: SubjectKind; id: number; label?: string; back?: string }) {
  const params = new URLSearchParams({ kind, id: String(id), ...(back ? { back } : {}) });
  return (
    <Link className="wf-link-button" href={`/report?${params}`} rel="nofollow" prefetch={false}>
      {label}
    </Link>
  );
}
