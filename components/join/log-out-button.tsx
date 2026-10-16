"use client";

import { useState } from "react";
import { post } from "../../lib/client/post";

export function LogOutButton({ className = "button button--secondary me-logout", children }: { className?: string; children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await post("/api/auth/logout", {});
        window.location.assign("/");
      }}
    >
      {children}
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
