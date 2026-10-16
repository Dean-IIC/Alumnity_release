import type { ReactNode } from "react";
import { batchLabel, ROLE_LABEL } from "../../lib/format";
import { Avatar } from "../social/avatar";

type MemberLineProps = {
  member: { id: number; name: string; branch: string | null; joined: number | null; role: string };
  /** What they do now, if the viewer may see it. */
  detail?: string;
  children?: ReactNode;
  /** Their photo (an upload id); without one, their ink seal. */
  photoId?: string | null;
};

/** A member in a list: their name (to their page), batch, and what they do; actions to the right. */
export function MemberLine({ member, detail, children, photoId }: MemberLineProps) {
  return (
    <li className="wf-member wf-member--face">
      <a href={`/people/${member.id}`} className="wf-member__face" tabIndex={-1} aria-hidden="true">
        <Avatar name={member.name} photoId={photoId} size={44} />
      </a>
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
