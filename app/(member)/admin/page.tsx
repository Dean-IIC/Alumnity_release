import { redirect } from "next/navigation";

/** /admin is where people look first: it's the college desk. */
export default function Admin() {
  redirect("/desk");
}
