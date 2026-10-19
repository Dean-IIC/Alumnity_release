/**
 * HKBK College of Engineering, as its own site (hkbkce.in) states it: the facts the header,
 * footer and landing repeat. One place, so they're said the same way everywhere and are
 * easy to correct.
 */
export const COLLEGE = {
  name: "HKBK College of Engineering",
  place: "Nagawara, Bengaluru",
  established: 1997,
  affiliation: "Affiliated to VTU, Belagavi",
  approval: "Approved by AICTE, New Delhi",
  address: ["#22/1, Opp. Manyata Tech Park, Nagawara", "Bengaluru 560045, Karnataka"],
  site: "https://www.hkbkce.in",
  directions: "https://www.google.com/maps/search/?api=1&query=HKBK%20College%20of%20Engineering%2C%20Nagawara%2C%20Bengaluru%20560045",
  motto: "Pursuit of knowledge is eternal"
} as const;

/** The college's leadership, with their photos from hkbkce.in/leadership. */
export const LEADERS = [
  { name: "Shri C M Ibrahim", role: "Chairman, HKBK Group of Institutions", photo: "/college/chairman.jpg", href: `${COLLEGE.site}/leadership#chairman` },
  { name: "Shri C M Faiz Mohammed", role: "Director, HKBK College of Engineering", photo: "/college/director.jpg", href: `${COLLEGE.site}/leadership#director` },
  { name: "Dr. Mohammed Riyaz Ahmed", role: "Principal, HKBK College of Engineering", photo: "/college/principal.jpg", href: `${COLLEGE.site}/leadership#principal` }
] as const;

/** The college site's own pages, for the footer's quick links (all on hkbkce.in). */
export const COLLEGE_LINKS = [
  ["About the college", "/about"],
  ["Vision and mission", "/about#vision-mission"],
  ["Leadership", "/leadership"],
  ["Programmes", "/programmes"],
  ["Departments", "/academics"],
  ["Placements", "/placements"],
  ["HKBK Research", "https://research.hkbkce.in"],
  ["News and events", "/news"],
  ["IQAC", "/iqac"],
  ["Contact the college", "/contact"]
].map(([label, href]) => [label, href.startsWith("http") ? href : `${COLLEGE.site}${href}`] as const);
