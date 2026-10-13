import { describe, expect, it } from "vitest";
import { CAMPUS_STOPS, DEFAULT_STOP_ID, findCampusStop, WELCOME_COPY } from "../lib/campus";

describe("campus stops", () => {
  it("keeps four distinct local campus stops and defaults to CSE", () => {
    expect(CAMPUS_STOPS).toHaveLength(4);
    expect(DEFAULT_STOP_ID).toBe("cse-block");
    expect(CAMPUS_STOPS.every((stop) => stop.image.startsWith("/assets/campus/"))).toBe(true);
    expect(CAMPUS_STOPS.map((stop) => stop.id)).toEqual([
      "cse-block",
      "front-building",
      "glass-block",
      "tower"
    ]);
    expect(findCampusStop("unknown")).toBeUndefined();
  });
});

describe("landing copy", () => {
  it("keeps the welcome purpose and two clear next actions", () => {
    expect(WELCOME_COPY.title).toBe("Stay connected to where it began.");
    expect(WELCOME_COPY.primaryAction).toBe("Find your place");
    expect(WELCOME_COPY.secondaryAction).toBe("I’m already here");
  });
});
