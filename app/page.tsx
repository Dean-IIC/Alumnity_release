import { redirect } from "next/navigation";
import { CampusLanding } from "../components/campus-landing";
import { currentUser } from "../lib/server/session";

// Who's signed in decides what "/" is: members go to their Home (unless they asked to watch
// the intro again, ?intro=1); visitors get the landing.
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ intro?: string }> }) {
  if (!(await searchParams).intro && (await currentUser())) redirect("/home");
  return <CampusLanding />;
}
