import type { ReactNode } from "react";
import { batchLabel, ROLE_LABEL } from "../../lib/format";

type MemberLineProps = {
  member: { id: number; name: string; branch: string | null; joined: number | null; role: string };
  /** What they do now, if the viewer may see it. */
  detail?: string;
  children?: ReactNode;
};

/** A member in a list: their name (to their page), batch, and what they do; actions to the right. */
export function MemberLine({ member, detail, children }: MemberLineProps) {
  return (
    <li className="wf-member">
      <div className="wf-member__who">
        <a className="wf-member__name" href={`/people/${member.id}`}>
          {member.name}
        </a>
        <span className="wf-muted">
          {[batchLabel(member), member.role !== "alumnus" && member.role !== "student" ? ROLE_LABEL[member.role] : ""].filter(Boolean).join(" · ")}
        </span>
        {detail && <span className="wf-member__detail">{detail}</span>}
      </div>
      {children && <div className="wf-actions">{children}</div>}
    </li>
  );
}
