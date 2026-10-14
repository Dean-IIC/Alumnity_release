export type CampusBlockId = "a-cse" | "c";

export type CampusBlock = {
  id: CampusBlockId;
  label: string;
  /** Real colour photograph. */
  photo: string;
  /** The same photograph through the pencil-sketch filter (scripts/make-journey-photos.py). */
  sketch: string;
  orientation: "landscape" | "portrait";
  /** Where the ink drop lands on the photo, as fractions of its width and height. */
  inkOrigin: { x: number; y: number };
};

const journey = (file: string) => `/assets/campus/journey/${file}`;

export type HeroPhoto = {
  src: string;
  sketch: string;
  label: string;
  title: string;
  /** Where the ink drop lands, as fractions of width and height: on the subject, not the sky. */
  inkOrigin: { x: number; y: number };
};

const hero = (file: string) => `/assets/campus/hero/${file}`;

/** The hero's one photograph: the glass block at sunset, from the college's own photo archive. */
export const HERO_PHOTO: HeroPhoto = {
  src: hero("glass-block.jpg"),
  sketch: hero("glass-block-sketch.jpg"),
  label: "Campus",
  title: "The glass block at sunset",
  inkOrigin: { x: 0.5, y: 0.5 }
};

/** Campus photographs the eras use (today's campus, standing in for the place). */
export const CAMPUS_BLOCKS: CampusBlock[] = [
  {
    id: "a-cse",
    label: "A block · CSE",
    photo: journey("a-cse.jpg"),
    sketch: journey("a-cse-sketch.jpg"),
    orientation: "landscape",
    inkOrigin: { x: 0.5, y: 0.5 }
  },
  {
    id: "c",
    label: "C block",
    photo: journey("c.jpg"),
    sketch: journey("c-sketch.jpg"),
    orientation: "portrait",
    inkOrigin: { x: 0.5, y: 0.5 }
  }
];

export const WELCOME_COPY = {
  title: "Stay connected to where it began.",
  primaryAction: "Find your place",
  secondaryAction: "I’m already here"
} as const;

export function findCampusBlock(id: string): CampusBlock | undefined {
  return CAMPUS_BLOCKS.find((block) => block.id === id);
}
