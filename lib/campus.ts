export type CampusStopId = "cse-block" | "front-building" | "glass-block" | "tower";

export type CampusStop = {
  id: CampusStopId;
  label: string;
  eyebrow: string;
  image: string;
  x: number;
  y: number;
};

export const DEFAULT_STOP_ID: CampusStopId = "cse-block";

export const WELCOME_COPY = {
  title: "Stay connected to where it began.",
  primaryAction: "Find your place",
  secondaryAction: "I’m already here"
} as const;

export const CAMPUS_STOPS: CampusStop[] = [
  {
    id: "cse-block",
    label: "College of Engineering",
    eyebrow: "Where it all began",
    image: "/assets/campus/cse-block.jpg",
    x: 52,
    y: 57
  },
  {
    id: "front-building",
    label: "The front block",
    eyebrow: "A familiar way in",
    image: "/assets/campus/front-building.jpg",
    x: 40,
    y: 76
  },
  {
    id: "glass-block",
    label: "The glass block",
    eyebrow: "New conversations begin here",
    image: "/assets/campus/glass-block.png",
    x: 79,
    y: 58
  },
  {
    id: "tower",
    label: "The tower",
    eyebrow: "Still part of your view",
    image: "/assets/campus/tower.png",
    x: 63,
    y: 29
  }
];

export function findCampusStop(id: string): CampusStop | undefined {
  return CAMPUS_STOPS.find((stop) => stop.id === id);
}
