/*
 * Who is responsible for Alumnity, for the privacy policy and terms (app/privacy,
 * app/terms). THE COLLEGE MUST FILL THESE IN before launch, and have both pages read by
 * whoever handles its legal and compliance matters: until then the pages say so.
 */

export const LEGAL = {
  /** The data fiduciary under India's Digital Personal Data Protection Act, 2023. */
  fiduciary: "HKBK College of Engineering, Bengaluru",
  /** Its postal address. */
  address: "", // e.g. "22/1, Nagawara, Bengaluru 560045" — to be confirmed by the college
  /** Where members write about their data, and anything else. */
  contactEmail: "", // e.g. "alumni@hkbk.edu.in"
  /** The grievance officer (DPDP Act s. 8(10)): a named person and how to reach them. */
  grievanceOfficer: "", // e.g. "Name, Designation, email, phone"
  /** When these were last changed (shown on the pages). */
  updated: "16 October 2026"
} as const;

export const legalReady = () => Boolean(LEGAL.address && LEGAL.contactEmail && LEGAL.grievanceOfficer);
