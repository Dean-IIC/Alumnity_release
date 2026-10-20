"use client";

import { useState } from "react";
import { WhoReacted } from "./who-reacted";

/** "See who reacted": opens the list for one post (Your activity). */
export function WhoReactedButton({ postId, count }: { postId: number; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="button button--secondary wf-small" onClick={() => setOpen(true)} disabled={count === 0}>
        {count === 0 ? "No reactions yet" : `See who reacted (${count})`}
      </button>
      <WhoReacted postId={postId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
