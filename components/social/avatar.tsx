import type { CSSProperties } from "react";
import { mediaUrl } from "../../lib/media-url";
import { cropStyle, readPhotoKey, sharper } from "../../lib/photo-crop";
import { initialsOf } from "../profile/ink-seal";

/*
 * A member's face in a list or a feed: their photo, or a small printed seal (their
 * initials in blue ink). The full seal on a member's page uses an ink filter; at this size,
 * dozens of those would slow a phone, so this one is plain.
 *
 * `photoId` is a photo key (lib/photo-crop.ts). A photo they've framed sits in a round
 * window that clips it (the window takes the .avatar sizes pages give); one they haven't
 * is the plain <img> it always was.
 */

export function Avatar({ name, photoId, size = 44, className = "" }: { name: string; photoId?: string | null; size?: number; className?: string }) {
  if (photoId) {
    const { id, crop } = readPhotoKey(photoId);
    if (crop) {
      return (
        <span className={`avatar avatar--framed ${className}`} style={{ "--avatar-size": `${size}px` } as CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(id, size * sharper(crop))} alt="" width={size} height={size} loading="lazy" decoding="async" style={cropStyle(crop)} />
        </span>
      );
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`avatar ${className}`} src={mediaUrl(id, size)} alt="" width={size} height={size} loading="lazy" decoding="async" />;
  }
  return (
    <svg className={`avatar avatar--seal ${className}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22.5" className="avatar__edge" />
      <circle cx="24" cy="24" r="17.5" className="avatar__inner" />
      <text x="24" y="29.5" textAnchor="middle" className="avatar__initials">
        {initialsOf(name)}
      </text>
    </svg>
  );
}
