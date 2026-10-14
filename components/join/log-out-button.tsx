"use client";

import { useState } from "react";
import { post } from "../../lib/client/post";

export function LogOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="button button--secondary me-logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await post("/api/auth/logout", {});
        window.location.assign("/");
      }}
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
