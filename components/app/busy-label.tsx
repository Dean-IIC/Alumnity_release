"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * A button's words that change the moment it's pressed ("Connect" → "Requested"), so the
 * tap answers at once while the server catches up. Goes inside an ActionForm's button.
 */
export function BusyLabel({ idle, busy }: { idle: ReactNode; busy: ReactNode }) {
  const { pending } = useFormStatus();
  return <>{pending ? busy : idle}</>;
}
