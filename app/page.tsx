import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusLanding } from "../components/campus-landing";
import { INTRO_COOKIE } from "../lib/intro-preference";
import { currentUser } from "../lib/server/session";

// Who's signed in decides what "/" is. Visitors get the landing. Members get the intro too
// (with its "Skip intro"), then go on to their Home; a member who ticked "Don't play the
// intro next time" goes straight Home, unless they asked for it (?intro=1, "Play the
// intro" in the footer).
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ intro?: string }> }) {
  const replay = (await searchParams).intro;
  if (await currentUser()) {
    if (!replay && (await cookies()).get(INTRO_COOKIE)?.value === "skip") redirect("/home");
    return <CampusLanding then="/home" />;
  }
  return <CampusLanding />;
}
