export type CampusBlockId = "a-cse" | "admin" | "b" | "c" | "d";

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

export const FINAL_BLOCK_ID: CampusBlockId = "d";
export const HERO_IMAGE = "/assets/campus/aerial.png";

/** The physical route along the campus spine, east to west: A/CSE → Admin → B → C → D. */
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
    id: "admin",
    label: "Admin block",
    photo: journey("admin.jpg"),
    sketch: journey("admin-sketch.jpg"),
    orientation: "landscape",
    inkOrigin: { x: 0.5, y: 0.5 }
  },
  {
    id: "b",
    label: "B block",
    photo: journey("b.jpg"),
    sketch: journey("b-sketch.jpg"),
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
  },
  {
    id: "d",
    label: "D block",
    photo: journey("d.jpg"),
    sketch: journey("d-sketch.jpg"),
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
