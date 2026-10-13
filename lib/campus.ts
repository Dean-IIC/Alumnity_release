export type CampusBlockId = "a-cse" | "admin" | "b" | "c" | "d";

export type CampusBlock = {
  id: CampusBlockId;
  label: string;
  illustration: string;
  x: number;
  y: number;
};

export const FINAL_BLOCK_ID: CampusBlockId = "d";
export const D_BLOCK_REAL_IMAGE = "/assets/campus/growing-intro/d-block-real.jpg";

export const CAMPUS_BLOCKS: CampusBlock[] = [
  {
    id: "a-cse",
    label: "A block · CSE",
    illustration: "/assets/campus/growing-intro/a-cse-ink.png",
    x: 82,
    y: 34
  },
  {
    id: "admin",
    label: "Admin block",
    illustration: "/assets/campus/growing-intro/admin-ink.png",
    x: 66,
    y: 47
  },
  {
    id: "b",
    label: "B block",
    illustration: "/assets/campus/growing-intro/b-ink.png",
    x: 49,
    y: 54
  },
  {
    id: "c",
    label: "C block",
    illustration: "/assets/campus/growing-intro/c-ink.png",
    x: 31,
    y: 63
  },
  {
    id: "d",
    label: "D block",
    illustration: "/assets/campus/growing-intro/d-ink.png",
    x: 14,
    y: 72
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
