import { findCampusBlock } from "./campus";

/**
 * The intro's stops: eras of HKBK, oldest first.
 *
 * Batch numbers come from the UG sheet of the Department of Examination's
 * "Academic year 1998 to 2022 Batch Passout Details.xls": a batch is its joining year
 * (the sheet's Batch column, matching the USN). The college was founded in 1997, but the
 * register starts with the 1998 batch, so that is "the earliest on record", not the first.
 *
 * Photos: 2008 and 2010 are from the college's old website (hkbkeducation.org, as kept
 * by the Wayback Machine, 2014); their years are the college's own folder names there.
 * 2025 is from the old alumni portal's gallery. 1998 and 2016 are today's campus,
 * standing in for the place, not the year — no caption claims they were taken then.
 */
export type JourneyPhoto = {
  id: string;
  /** Real colour photograph. */
  photo: string;
  /** The same photograph through the pencil-sketch filter (scripts/make-journey-photos.py). */
  sketch: string;
  orientation: "landscape" | "portrait";
  /** Where the ink drop lands on the photo, as fractions of its width and height. */
  inkOrigin: { x: number; y: number };
  /** Where the photo came from. */
  source: string;
};

export type Era = {
  year: number;
  title: string;
  detail: string;
  photo: JourneyPhoto;
};

const campus = (id: string): JourneyPhoto => {
  const block = findCampusBlock(id);
  if (!block) throw new Error(`No campus photo "${id}"`);
  return { ...block, source: "Today's campus" };
};

const archive = (id: string, source: string): JourneyPhoto => ({
  id,
  photo: `/assets/campus/journey/${id}.jpg`,
  sketch: `/assets/campus/journey/${id}-sketch.jpg`,
  orientation: "landscape",
  inkOrigin: { x: 0.5, y: 0.5 },
  source
});

const OLD_SITE = "hkbkeducation.org, via the Wayback Machine (2014)";

export const ERAS: Era[] = [
  {
    year: 1998,
    title: "The earliest batch on record",
    detail: "125 students · CSE, ECE, ISE, Mechanical",
    photo: campus("a-cse")
  },
  {
    year: 2008,
    title: "Alumni come home",
    detail: "The BE alumni meet",
    photo: archive("era-2008-alumni-meet", `${OLD_SITE}: alumni/Group Photos/2008BE-Alumni-Meet`)
  },
  {
    year: 2010,
    title: "The Army comes recruiting",
    detail: "Indian Army campus recruitment drive",
    photo: archive("era-2010-army-drive", `${OLD_SITE}: HRD-Placement/photogallery/2010IndianArmy`)
  },
  {
    year: 2016,
    title: "The biggest batch",
    detail: "527 students",
    photo: campus("c")
  },
  {
    year: 2025,
    title: "Class of 2025",
    detail: "Graduation Day",
    photo: archive("era-2025-graduation", "The old HKBK alumni portal's gallery")
  }
];

/** Undergraduate rows across every batch in the sheet, 1998–2023. */
export const STUDENTS_SINCE_1998 = 8838;
