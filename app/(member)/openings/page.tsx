import { redirect } from "next/navigation";

/* Jobs and internships are posts with #job or #internship now, on the HKBK board. */
export default function Openings() {
  redirect("/board?tag=job");
}
