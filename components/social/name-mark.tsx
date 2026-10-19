import type { Role } from "../../lib/server/auth";

/** Staff, by the short word shown beside their name. */
const STAFF: Partial<Record<Role, string>> = { faculty: "Faculty", coordinator: "Coordinator", admin: "Admin", superadmin: "Admin" };

/**
 * Beside a member's name, wherever it's shown: a small seal for someone found on the
 * college's register (every student and alumnus here), or their role for staff, who join
 * by invitation. Decided on the server; nothing but the mark reaches the page.
 */
export function NameMark({ who }: { who: { usn: string | null; role: Role } }) {
  const staff = STAFF[who.role];
  if (staff)
    return (
      <span className="name-mark name-mark--staff" title={`${staff} at HKBK College of Engineering`}>
        {staff}
      </span>
    );
  if (!who.usn) return null;
  return (
    <span className="name-mark name-mark--verified" role="img" aria-label="Verified: on the HKBK college register" title="Verified: on the HKBK college register">
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path d="M8 1l1.8 1.3 2.2-.1.7 2.1 1.8 1.3-.7 2.1.7 2.1-1.8 1.3-.7 2.1-2.2-.1L8 15l-1.8-1.3-2.2.1-.7-2.1L1.5 10.4l.7-2.1-.7-2.1 1.8-1.3.7-2.1 2.2.1Z" />
        <path className="name-mark__tick" d="M5.2 8.2l1.9 1.9 3.7-3.9" />
      </svg>
    </span>
  );
}
