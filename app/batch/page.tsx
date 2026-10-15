import { redirect } from "next/navigation";
import { requireUser } from "../../lib/server/session";

export const dynamic = "force-dynamic";

/** Your batch: straight to its page (or to People, if your batch isn't known). */
export default async function MyBatch() {
  const me = await requireUser("/batch");
  redirect(me.branch && me.joined ? `/batch/${encodeURIComponent(me.branch)}/${me.joined}` : "/people");
}
