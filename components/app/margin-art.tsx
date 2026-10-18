"use client";

import { usePathname } from "next/navigation";

/*
 * The paper's margins, a different drawing for each part of Alumnity, in the landing
 * page's pen: 2.4 px round strokes in red, blue and gold, faint, behind everything.
 * Home is each person's own (a student's books and bulbs, an alumnus's thrown caps and
 * chai, a teacher's classroom, the desk's stamps, the super administrator's gears); People has pencils, rulers and a compass; Messages,
 * envelopes, stamps and paper planes; Events, bunting and tickets; Causes, hearts and an
 * inkwell; your batch, graduation caps flying. Wide screens get a column down each side;
 * phones get a small cluster by the page's title and another at its foot.
 * Static: nothing animates, so it costs nothing after it's drawn.
 */

type Tone = "red" | "blue" | "gold" | "green";

/** Each motif drawn about 60 units across, centred on 0,0. */
const MOTIFS = {
  cap: "M-30 -6 0 -18 30 -6 0 6Z M-18 -1V9c0 7 36 7 36 0V-1 M24 -3v14 M24 11l-4 9 M24 11l4 9",
  pencil: "M-34 -6H20l14 6-14 6H-34Z M20 -6v12 M29 -2l5 2-5 2 M-26 -6v12",
  ruler: "M-36 -6H36V6H-36Z M-28 -6v5 M-20 -6v7 M-12 -6v5 M-4 -6v8 M4 -6v5 M12 -6v7 M20 -6v5 M28 -6v7",
  compass: "M0 -26a4 4 0 1 0 0.1 0 M0 -22 -13 22 M0 -22 13 22 M-7 2H7 M13 22l2 6",
  envelope: "M-26 -16H26V16H-26Z M-26 -16 0 4 26 -16 M-26 16 -6 -1 M26 16 6 -1",
  stamp: "M-16 -20H16V20H-16Z M-11 -15H11V15H-11Z M-6 4c0-6 12-6 12 0 M0 -8v12",
  postmark: "M-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0 M-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M20 -8c6-4 12 4 18 0s12 4 18 0 M20 0c6-4 12 4 18 0s12 4 18 0 M20 8c6-4 12 4 18 0s12 4 18 0",
  plane: "M-28 4 30 -18 6 20 0 6Z M0 6 30 -18 M0 6-6 18 6 20",
  trail: "M-34 10c-14 8-28 2-40 10s-24 10-36 4",
  bulb: "M-10 8c-12-10-8-32 10-32s22 22 10 32v6H-10Z M-8 19H8 M-5 24H5 M0 -33v-7 M-21 -26l-5-5 M21 -26l5-5",
  book: "M0 -12c-10-6-22-6-30-2v30c8-4 20-4 30 2c10-6 22-6 30-2v-30c-8-4-20-4-30 2v30",
  star: "M0 -20 6 -6H21L9 3l4 15-13-9-13 9 4-15-12-9H-6Z",
  sparkle: "M0 -14c2 10 4 12 14 14-10 2-12 4-14 14-2-10-4-12-14-14 10-2 12-4 14-14Z",
  heart: "M0 14C-18 2-22-8-14-14c6-4 12 0 14 6 2-6 8-10 14-6 8 6 4 16-14 28Z",
  drop: "M0 -18c8 12 12 18 12 24a12 12 0 0 1-24 0c0-6 4-12 12-24Z",
  inkwell: "M-16 -6H16l4 24H-20Z M-8 -6v-6H8v6 M10 -12c10-18 24-28 34-30-4 12-16 24-30 28",
  bell: "M-14 8V-2a14 14 0 0 1 28 0V8l4 4H-18Z M-4 16a4 4 0 0 0 8 0 M0 -16v-4",
  bubble: "M-24 -14H24a4 4 0 0 1 4 4V8a4 4 0 0 1-4 4H-6l-10 8v-8h-8a4 4 0 0 1-4-4V-10a4 4 0 0 1 4-4Z M-10 -1h1 M0 -1h1 M10 -1h1",
  gear: "M-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M0 -16v5 M0 11v5 M-16 0h5 M11 0h5 M-11 -11l3.5 3.5 M7.5 7.5 11 11 M-11 11l3.5-3.5 M7.5 -7.5 11 -11",
  ticket: "M-26 -12H26v8a4 4 0 0 0 0 8v8H-26V4a4 4 0 0 0 0-8Z M-10 -12v24",
  scroll: "M-24 -8H20a6 6 0 0 1 0 12H-24a6 6 0 0 1 0-12Z M-2 4-6 16l6-4 6 4-4-12",
  question: "M-8 -10c0-12 18-12 18 0 0 8-10 8-10 16 M0 14v1",
  cup: "M-12 -4H12V8a8 8 0 0 1-8 8H-4a8 8 0 0 1-8-8Z M12 0c8 0 8 10 0 10 M-4 -10c-4-4 4-6 0-10 M4 -10c-4-4 4-6 0-10",
  link: "M-18 -8h10a8 8 0 0 1 0 16h-10a8 8 0 0 1 0-16Z M8 -8h10a8 8 0 0 1 0 16H8a8 8 0 0 1 0-16Z M-8 0h16",
  flower: "M0 0c-10-26 20-26 10 0 26-8 26 22 0 10 8 26-22 26-10 0-26 8-26-22 0-10Z",
  leaf: "M0 0c18-22 52-24 70-6-20 20-52 22-70 6Z M0 0 58 -8",
  swirl: "M0 0c0-20 30-20 30 0 0 30-46 30-46 0 0-40 62-40 62 0",
  plus: "M0 -10v20 M-10 0h20",
  nib: "M0 22-12 -6 0 -24 12 -6Z M0 22V0 M-3 -2a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  flag: "M0 0 14 0 7 16Z"
} as const;

type MotifName = keyof typeof MOTIFS;
/** A motif placed: what, where (in a 300 × 900 column), turned how far, how big, which ink. */
type Place = [MotifName, number, number, number, number, Tone];
type Theme = { spine: { d: string; tone: Tone; dashed?: boolean }[]; marks: Place[]; dots: [number, number][]; phone: Place[] };


const THEMES: Record<string, Theme> = {
  // Home, a student's: books open, pencils, a bulb lit, questions asked.
  "home-student": {
    spine: [{ d: "M40 -20V940 M48 -20V940", tone: "blue" }],
    marks: [
      ["book", 170, 160, -8, 1.2, "blue"],
      ["pencil", 120, 330, -40, 1.1, "red"],
      ["bulb", 200, 500, 0, 1.1, "gold"],
      ["question", 120, 680, 10, 1.1, "blue"],
      ["ruler", 190, 840, 70, 0.9, "green"],
      ["sparkle", 230, 260, 0, 0.7, "gold"]
    ],
    dots: [[240, 400], [80, 560], [230, 760]],
    phone: [["book", 85, 45, -8, 0.7, "blue"], ["bulb", 140, 45, 0, 0.6, "gold"]]
  },
  // Home, an alumnus's: caps thrown, letters flown home, chai with old friends.
  "home-alumnus": {
    spine: [{ d: "M30 940C150 760 40 600 170 420S90 140 230 -20", tone: "gold", dashed: true }],
    marks: [
      ["cap", 160, 160, -16, 1.2, "gold"],
      ["plane", 120, 340, -12, 1.1, "blue"],
      ["cup", 200, 510, 0, 1.2, "red"],
      ["link", 120, 690, 20, 1.1, "green"],
      ["star", 200, 840, 8, 0.8, "green"],
      ["sparkle", 230, 260, 0, 0.7, "gold"]
    ],
    dots: [[240, 420], [70, 600], [230, 760]],
    phone: [["cap", 85, 45, -16, 0.7, "gold"], ["plane", 140, 45, -12, 0.6, "blue"]]
  },
  // Home, a teacher's: the classroom: an open book, a pen nib, the ruler, the bell.
  "home-faculty": {
    spine: [{ d: "M40 -20V940", tone: "red" }],
    marks: [
      ["book", 160, 170, 6, 1.2, "red"],
      ["nib", 120, 360, 22, 1.2, "blue"],
      ["bell", 200, 530, -8, 1.2, "gold"],
      ["ruler", 130, 710, 75, 1, "green"],
      ["inkwell", 200, 850, 0, 0.9, "blue"],
      ["sparkle", 230, 270, 0, 0.7, "gold"]
    ],
    dots: [[240, 440], [80, 620]],
    phone: [["book", 85, 45, 6, 0.7, "red"], ["bell", 140, 45, -8, 0.6, "gold"]]
  },
  // Home, the desk's: rubber stamps, the minutes, a postmark, the college's flag.
  "home-desk": {
    spine: [{ d: "M40 -20V940 M70 -20V940", tone: "blue" }],
    marks: [
      ["stamp", 170, 160, -8, 1.2, "blue"],
      ["scroll", 120, 360, 6, 1.1, "gold"],
      ["postmark", 200, 530, 0, 1, "red"],
      ["flag", 130, 710, 8, 1.1, "green"],
      ["sparkle", 230, 280, 0, 0.6, "gold"]
    ],
    dots: [[240, 440], [80, 620], [230, 820]],
    phone: [["stamp", 85, 45, -8, 0.7, "blue"], ["flag", 140, 45, 8, 0.6, "green"]]
  },
  // Home, the super administrator's: the works: gears, the compass, the seal, the stars.
  "home-super": {
    spine: [{ d: "M60 -20V180H140V420H70V700H150V940", tone: "gold" }],
    marks: [
      ["gear", 160, 170, 0, 1.4, "blue"],
      ["compass", 120, 370, -10, 1.2, "green"],
      ["stamp", 200, 540, 8, 1.1, "red"],
      ["gear", 120, 720, 20, 1, "gold"],
      ["star", 210, 850, 0, 0.9, "green"],
      ["sparkle", 230, 280, 0, 0.7, "gold"]
    ],
    dots: [[240, 460], [80, 620]],
    phone: [["gear", 85, 45, 0, 0.7, "blue"], ["compass", 140, 45, -10, 0.6, "green"]]
  },
  // People: a card catalogue's desk: pencils, a ruler, a compass, an eraser's dust.
  people: {
    spine: [{ d: "M40 -20V940", tone: "red" }, { d: "M48 -20V940", tone: "red" }],
    marks: [
      ["pencil", 160, 140, -60, 1.1, "gold"],
      ["ruler", 150, 380, 75, 1.1, "green"],
      ["compass", 190, 600, 12, 1.2, "green"],
      ["pencil", 140, 820, 25, 1, "blue"],
      ["sparkle", 230, 260, 0, 0.6, "gold"],
      ["plus", 110, 500, 0, 0.7, "gold"],
      ["swirl", 230, 760, 0, 0.6, "green"]
    ],
    dots: [[120, 220], [240, 470], [90, 700]],
    phone: [["pencil", 90, 40, -30, 0.8, "gold"], ["compass", 140, 50, 12, 0.7, "green"]]
  },
  // Groups: speech bubbles and gears (departments), joined by a loose thread.
  groups: {
    spine: [{ d: "M30 -20c60 120-40 200 20 320s-50 220 10 340 30 160 0 260", tone: "blue", dashed: true }],
    marks: [
      ["bubble", 170, 130, -6, 1.1, "blue"],
      ["gear", 120, 330, 0, 1.4, "gold"],
      ["bubble", 200, 520, 8, 0.9, "red"],
      ["cap", 130, 700, 10, 1, "blue"],
      ["link", 210, 830, -20, 1, "green"],
      ["sparkle", 240, 300, 0, 0.6, "gold"],
      ["plus", 90, 470, 0, 0.7, "red"]
    ],
    dots: [[230, 220], [80, 600], [250, 680]],
    phone: [["bubble", 80, 40, -6, 0.75, "blue"], ["gear", 140, 60, 0, 0.8, "gold"]]
  },
  // Messages: letters, a stamp, a postmark, and planes on their way.
  messages: {
    spine: [{ d: "M200 -20c-80 140 60 240-20 380s60 260-10 380", tone: "gold", dashed: true }],
    marks: [
      ["envelope", 110, 150, -10, 1.2, "blue"],
      ["stamp", 210, 300, 8, 1, "red"],
      ["postmark", 90, 470, -6, 1, "gold"],
      ["plane", 200, 640, -12, 1.1, "blue"],
      ["trail", 200, 640, -12, 1.1, "blue"],
      ["envelope", 120, 820, 14, 1, "red"],
      ["sparkle", 240, 120, 0, 0.6, "gold"]
    ],
    dots: [[60, 300], [250, 520], [70, 700]],
    phone: [["envelope", 80, 45, -10, 0.7, "blue"], ["stamp", 135, 40, 8, 0.6, "red"]]
  },
  // Notifications: bells and the day's sparkle.
  notifications: {
    spine: [{ d: "M60 -20c40 40-40 80 0 120s-40 80 0 120-40 80 0 120-40 80 0 120-40 80 0 120-40 80 0 120-40 80 0 120-40 80 0 120", tone: "blue", dashed: true }],
    marks: [
      ["bell", 150, 160, -14, 1.3, "blue"],
      ["sparkle", 220, 110, 0, 0.8, "gold"],
      ["star", 110, 380, 10, 1, "red"],
      ["bell", 200, 560, 12, 1, "gold"],
      ["sparkle", 90, 700, 0, 0.7, "blue"],
      ["star", 210, 820, -8, 0.8, "gold"]
    ],
    dots: [[240, 300], [70, 520], [250, 700]],
    phone: [["bell", 90, 45, -14, 0.8, "blue"], ["sparkle", 140, 25, 0, 0.6, "gold"]]
  },
  // Ask a senior: planes taking questions up, a bulb, a book.
  ask: {
    spine: [{ d: "M40 940c40-140-30-220 20-340s-40-220 10-340 20-200 0-280", tone: "red", dashed: true }],
    marks: [
      ["plane", 170, 140, -20, 1.2, "blue"],
      ["trail", 170, 140, -20, 1.2, "blue"],
      ["bulb", 120, 360, 6, 1.2, "gold"],
      ["question", 220, 470, 10, 1.3, "red"],
      ["book", 140, 640, -6, 1.1, "blue"],
      ["sparkle", 230, 760, 0, 0.7, "gold"],
      ["plane", 200, 860, -10, 0.8, "red"]
    ],
    dots: [[240, 260], [70, 520], [230, 600]],
    phone: [["plane", 85, 45, -20, 0.75, "blue"], ["bulb", 140, 50, 6, 0.65, "gold"]]
  },
  // Events: bunting strung down the margin, tickets, stars.
  events: {
    spine: [{ d: "M20 60C120 120 200 100 280 170 M20 520C120 580 200 560 280 630", tone: "red" }],
    marks: [
      ["flag", 60, 80, 10, 1.2, "green"],
      ["flag", 110, 102, 8, 1.2, "green"],
      ["flag", 160, 116, 4, 1.2, "green"],
      ["flag", 210, 130, 14, 1.2, "green"],
      ["ticket", 140, 320, -12, 1.2, "blue"],
      ["flag", 60, 540, 10, 1.2, "green"],
      ["flag", 110, 562, 8, 1.2, "green"],
      ["flag", 160, 576, 4, 1.2, "green"],
      ["flag", 210, 590, 14, 1.2, "green"],
      ["star", 200, 420, 10, 0.9, "gold"],
      ["ticket", 130, 790, 10, 1, "red"],
      ["sparkle", 230, 720, 0, 0.6, "gold"]
    ],
    dots: [[80, 420], [250, 300], [90, 680]],
    phone: [["ticket", 85, 45, -12, 0.7, "blue"], ["star", 140, 30, 10, 0.55, "gold"]]
  },
  // Causes: an inkwell, drops of ink falling, hearts.
  causes: {
    spine: [{ d: "M70 -20c-20 160 40 260 0 420s50 300 0 520", tone: "blue" }],
    marks: [
      ["inkwell", 150, 150, 0, 1.2, "blue"],
      ["drop", 110, 300, 0, 0.9, "blue"],
      ["heart", 200, 380, -10, 1.1, "red"],
      ["drop", 160, 520, 0, 0.7, "blue"],
      ["heart", 120, 660, 12, 0.9, "gold"],
      ["heart", 210, 800, -8, 0.8, "red"],
      ["sparkle", 230, 250, 0, 0.6, "gold"]
    ],
    dots: [[240, 560], [80, 460], [230, 680]],
    phone: [["inkwell", 85, 45, 0, 0.7, "blue"], ["heart", 140, 40, -10, 0.6, "red"]]
  },
  // Jobs and referrals: a path climbing up the margin, gears, a chain of links (one person
  // to the next), letters going out.
  openings: {
    spine: [{ d: "M40 940L40 800L130 800L130 640L220 640L220 470L120 470L120 300L230 300L230 120", tone: "green", dashed: true }],
    marks: [
      ["gear", 160, 120, 0, 1.2, "blue"],
      ["link", 90, 250, -20, 1.1, "green"],
      ["link", 140, 290, -20, 1.1, "green"],
      ["envelope", 200, 400, 8, 1.1, "red"],
      ["star", 80, 540, 0, 0.9, "gold"],
      ["gear", 190, 600, 20, 0.9, "gold"],
      ["envelope", 110, 740, -10, 1, "blue"],
      ["sparkle", 230, 860, 0, 0.6, "gold"]
    ],
    dots: [[240, 220], [70, 420], [230, 760]],
    phone: [["gear", 85, 45, 0, 0.7, "blue"], ["link", 140, 40, -20, 0.6, "green"]]
  },
  // Your batch: caps thrown in the air, a diploma, stars.
  batch: {
    spine: [{ d: "M30 940C150 760 40 600 170 420S90 140 230 -20", tone: "red", dashed: true }],
    marks: [
      ["cap", 160, 120, -20, 1.2, "blue"],
      ["cap", 220, 260, 18, 0.9, "gold"],
      ["star", 110, 360, 0, 0.8, "red"],
      ["scroll", 170, 500, -10, 1.2, "gold"],
      ["cap", 120, 680, 10, 1, "red"],
      ["sparkle", 220, 780, 0, 0.7, "blue"],
      ["star", 200, 620, 8, 0.6, "gold"]
    ],
    dots: [[70, 250], [240, 420], [80, 820]],
    phone: [["cap", 80, 40, -20, 0.8, "blue"], ["cap", 135, 55, 18, 0.6, "gold"]]
  },
  // Connections: links and letters between friends, a cup of chai.
  connections: {
    spine: [{ d: "M60 -20L180 200 80 420 200 640 90 940", tone: "gold" }],
    marks: [
      ["link", 160, 160, -20, 1.2, "green"],
      ["cup", 120, 340, 0, 1.2, "red"],
      ["envelope", 200, 520, 10, 0.9, "gold"],
      ["link", 130, 700, 25, 1, "green"],
      ["heart", 220, 820, -10, 0.7, "blue"],
      ["sparkle", 230, 300, 0, 0.6, "gold"]
    ],
    dots: [[60, 450], [240, 640], [80, 860]],
    phone: [["link", 85, 45, -20, 0.7, "green"], ["cup", 140, 45, 0, 0.6, "red"]]
  },
  // Your page and settings: a pencil, a ruler, a gear.
  me: {
    spine: [{ d: "M40 -20V940", tone: "red" }],
    marks: [
      ["pencil", 160, 160, -45, 1.1, "blue"],
      ["gear", 120, 380, 0, 1.3, "gold"],
      ["ruler", 180, 600, 80, 1, "green"],
      ["sparkle", 230, 760, 0, 0.7, "gold"],
      ["swirl", 120, 820, 0, 0.6, "green"]
    ],
    dots: [[240, 280], [80, 520], [230, 700]],
    phone: [["pencil", 85, 40, -45, 0.7, "blue"], ["gear", 140, 55, 0, 0.7, "gold"]]
  },
  // About: the college's own words, a book, a scroll and a pen nib.
  about: {
    spine: [{ d: "M40 -20V940 M50 -20V940", tone: "gold" }],
    marks: [
      ["book", 160, 170, -8, 1.3, "blue"],
      ["nib", 120, 380, 25, 1.2, "red"],
      ["scroll", 190, 560, -6, 1.1, "gold"],
      ["sparkle", 230, 300, 0, 0.7, "gold"],
      ["star", 110, 760, 10, 0.7, "green"]
    ],
    dots: [[240, 460], [80, 640], [230, 840]],
    phone: [["book", 85, 45, -8, 0.7, "blue"], ["nib", 140, 45, 25, 0.6, "red"]]
  },
  // The community: people linked up, talking over chai.
  community: {
    spine: [{ d: "M200 -20c-80 140 60 240-20 380s60 260-10 380", tone: "red", dashed: true }],
    marks: [
      ["link", 160, 170, -20, 1.2, "green"],
      ["bubble", 130, 360, 0, 1.1, "gold"],
      ["cup", 200, 540, 0, 1.2, "red"],
      ["heart", 120, 720, -10, 0.8, "blue"],
      ["sparkle", 230, 280, 0, 0.6, "gold"]
    ],
    dots: [[60, 470], [240, 640], [90, 860]],
    phone: [["link", 85, 45, -20, 0.7, "green"], ["bubble", 140, 45, 0, 0.6, "gold"]]
  },
  // The committee: the association's seal and its minutes.
  committee: {
    spine: [{ d: "M40 -20V940", tone: "gold" }],
    marks: [
      ["stamp", 170, 170, -8, 1.2, "red"],
      ["scroll", 130, 380, 6, 1.1, "blue"],
      ["star", 200, 560, 0, 0.9, "gold"],
      ["postmark", 120, 740, 0, 0.9, "red"],
      ["sparkle", 230, 300, 0, 0.6, "gold"]
    ],
    dots: [[240, 470], [80, 620]],
    phone: [["stamp", 85, 45, -8, 0.7, "red"], ["star", 140, 45, 0, 0.6, "gold"]]
  },
  // The developers: an idea, the gears, the pencil and compass it was drawn with.
  developers: {
    spine: [{ d: "M60 -20V180H140V420H70V700H150V940", tone: "blue" }],
    marks: [
      ["bulb", 160, 170, 0, 1.2, "gold"],
      ["gear", 120, 370, 0, 1.4, "blue"],
      ["pencil", 190, 560, -40, 1.1, "red"],
      ["compass", 120, 760, 10, 1.1, "green"],
      ["sparkle", 230, 290, 0, 0.7, "gold"]
    ],
    dots: [[240, 460], [70, 640], [230, 860]],
    phone: [["bulb", 85, 45, 0, 0.7, "gold"], ["gear", 140, 50, 0, 0.7, "blue"]]
  },
  // How it works: the route mapped out, a question, a paper plane on its way.
  "how-it-works": {
    spine: [{ d: "M40 940C200 820 60 640 200 520S60 260 180 120 120 -20 200 -40", tone: "gold", dashed: true }],
    marks: [
      ["compass", 160, 170, -10, 1.2, "green"],
      ["question", 120, 370, 8, 1.3, "red"],
      ["plane", 200, 540, -12, 1.1, "gold"],
      ["ruler", 130, 740, 70, 1, "green"],
      ["sparkle", 230, 300, 0, 0.7, "gold"]
    ],
    dots: [[240, 450], [80, 640], [230, 860]],
    phone: [["compass", 85, 45, -10, 0.7, "green"], ["plane", 140, 45, -12, 0.6, "gold"]]
  },
  // Privacy and terms: the fine print, signed and sealed.
  privacy: {
    spine: [{ d: "M40 -20V940", tone: "blue" }],
    marks: [
      ["scroll", 160, 170, -6, 1.2, "blue"],
      ["nib", 120, 380, 20, 1.2, "red"],
      ["stamp", 200, 580, 8, 1, "gold"],
      ["sparkle", 230, 300, 0, 0.6, "gold"]
    ],
    dots: [[240, 470], [90, 700]],
    phone: [["scroll", 85, 45, -6, 0.7, "blue"], ["nib", 140, 45, 20, 0.6, "red"]]
  },
  // The gallery: memories pinned up, caps thrown, a flag and stars.
  gallery: {
    spine: [{ d: "M20 120H280 M20 560H280", tone: "gold", dashed: true }],
    marks: [
      ["star", 160, 170, 0, 1.1, "gold"],
      ["cap", 120, 360, -14, 1.2, "blue"],
      ["flag", 200, 540, 8, 1.1, "green"],
      ["sparkle", 130, 720, 0, 0.9, "gold"],
      ["flower", 230, 300, 10, 0.8, "green"]
    ],
    dots: [[240, 440], [80, 620], [230, 840]],
    phone: [["star", 85, 45, 0, 0.7, "gold"], ["cap", 140, 50, -14, 0.6, "blue"]]
  },
  // Anywhere else: the paper's own marks, nothing borrowed from another page.
  paper: {
    spine: [{ d: "M40 -20V940", tone: "gold" }],
    marks: [
      ["sparkle", 160, 170, 0, 1, "gold"],
      ["star", 120, 380, 10, 0.9, "green"],
      ["plus", 200, 560, 0, 1, "red"],
      ["swirl", 130, 740, 0, 0.8, "green"]
    ],
    dots: [[240, 460], [80, 640]],
    phone: [["sparkle", 85, 45, 0, 0.7, "gold"], ["star", 140, 50, 10, 0.6, "green"]]
  },
  // The college desk: rubber stamps, a pen nib, the ledger's rules.
  desk: {
    spine: [{ d: "M40 -20V940 M70 -20V940", tone: "blue" }],
    marks: [
      ["stamp", 170, 160, -8, 1.2, "red"],
      ["nib", 140, 380, 20, 1.2, "blue"],
      ["postmark", 120, 560, 0, 1, "gold"],
      ["stamp", 200, 760, 10, 0.9, "blue"],
      ["sparkle", 230, 280, 0, 0.6, "gold"]
    ],
    dots: [[240, 460], [110, 700]],
    phone: [["stamp", 85, 45, -8, 0.7, "red"], ["nib", 140, 45, 20, 0.6, "blue"]]
  }
};

/** Whose Home it is: each role's has its own drawings (none of them the landing page's garden). */
export type HomeKind = "student" | "alumnus" | "faculty" | "desk" | "super";

/** Which drawing a page gets, from its address (and, on Home, whose it is). */
function themeFor(path: string, home: HomeKind): Theme {
  const first = path.split("/")[1] ?? "";
  if (first === "home" || first === "notes" || first === "report") return THEMES[`home-${home}`];
  const key = first === "settings" ? "me" : first === "admin" ? "desk" : first === "terms" ? "privacy" : first in THEMES ? first : "paper";
  return THEMES[key];
}

function Marks({ places }: { places: Place[] }) {
  return (
    <>
      {places.map(([name, x, y, angle, scale, tone], i) => (
        <path
          key={i}
          className={`margin-art__mark margin-art__mark--${tone} ${name === "trail" ? "margin-art__mark--dashed" : ""}`}
          d={MOTIFS[name]}
          transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}
        />
      ))}
    </>
  );
}

/** One column down a margin. The right one is the left turned over and shifted, so the two sides don't match. */
function Column({ theme, side }: { theme: Theme; side: "left" | "right" }) {
  return (
    <svg className={`margin-art__column margin-art__column--${side}`} viewBox="0 0 300 900" preserveAspectRatio="xMinYMid slice" aria-hidden="true">
      <g transform={side === "right" ? "translate(0 300)" : undefined}>
        {theme.spine.map((s, i) => (
          <path key={i} className={`margin-art__mark margin-art__mark--${s.tone} ${s.dashed ? "margin-art__mark--dashed" : ""}`} d={s.d} />
        ))}
        <Marks places={theme.marks} />
        {theme.dots.map(([x, y], i) => (
          <circle key={i} className="margin-art__dot" cx={x} cy={y} r={3} />
        ))}
      </g>
      {side === "right" && (
        <g transform="translate(0 -600)">
          <Marks places={theme.marks} />
        </g>
      )}
    </svg>
  );
}

/*
 * The whole page's paper: the same drawings, smaller and fainter, scattered over a tile
 * that repeats behind everything (cards are solid paper, so text never sits on it), and
 * a wash of the three inks in the corners. Every screen size gets it.
 */
const SCATTER: [number, number][] = [
  [70, 80],
  [300, 60],
  [190, 200],
  [40, 330],
  [330, 300],
  [230, 420],
  [110, 470]
];

function scatter(theme: Theme, at: [number, number][], shift: number, size: number): Place[] {
  const marks = theme.marks.filter(([name]) => name !== "trail");
  return at.map(([x, y], i) => {
    const [name, , , angle, scale, tone] = marks[(i + shift) % marks.length];
    return [name, x, y, angle + (i % 2 ? 14 : -10) + shift * 7, Math.min(scale, 1.2) * size, tone];
  });
}

/** Two tiles of different sizes, one turned a little, so the repeat never lines up into a grid. */
function Field({ theme, id }: { theme: Theme; id: string }) {
  return (
    <svg className="margin-art__field" aria-hidden="true">
      <defs>
        <pattern id={`${id}-a`} width="400" height="520" patternUnits="userSpaceOnUse">
          <Marks places={scatter(theme, SCATTER, 0, 0.78)} />
          {[[150, 120], [300, 200], [60, 420], [360, 470]].map(([cx, cy], i) => (
            <circle key={i} className="margin-art__dot" cx={cx} cy={cy} r={2.4} />
          ))}
        </pattern>
        <pattern id={`${id}-b`} width="620" height="700" patternUnits="userSpaceOnUse" patternTransform="rotate(9) translate(170 240)">
          <Marks places={scatter(theme, [[90, 130], [420, 90], [300, 380], [560, 520], [140, 600]], 2, 0.62)} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-a)`} />
      <rect className="margin-art__field-second" width="100%" height="100%" fill={`url(#${id}-b)`} />
    </svg>
  );
}

export function MarginArt({ home = "alumnus" }: { home?: HomeKind }) {
  const path = usePathname() ?? "/home";
  const theme = themeFor(path, home);
  const id = `paper-${path.split("/")[1] || "home"}-${home}`;
  return (
    <>
      <div className="margin-art__wash" aria-hidden="true" />
      <Field theme={theme} id={id} />
      <div className="margin-art" aria-hidden="true">
        <Column theme={theme} side="left" />
        <Column theme={theme} side="right" />
      </div>
      {/* Phones and tablets: a little drawing beside the page's title (it scrolls away with it). */}
      <svg className="margin-art__phone" viewBox="0 0 170 100" aria-hidden="true">
        <Marks places={[...theme.phone, ["sparkle", 28, 70, 0, 0.45, "gold"], ["plus", 160, 92, 0, 0.5, "red"]]} />
        <circle className="margin-art__dot" cx={40} cy={22} r={2.5} />
      </svg>
    </>
  );
}
