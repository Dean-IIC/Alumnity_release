import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RegisterBook } from "../components/join/register-book";

/*
 * The register on the join and log-in pages: testers couldn't see its "found" or "not found"
 * result. These check the result is always in the page for its state, that the records
 * streaming past are made up (never real register data), and that the phone rule which
 * folds the panel away applies only before a search.
 */
const line = { name: "Asha Rao", usn: "1HK00XX000", branch: "CSE", joined: 2015 };

describe("the register's scanning panel", () => {
  it("stamps the found line, and only when found", () => {
    const found = renderToStaticMarkup(<RegisterBook state="found" line={line} />);
    expect(found).toContain("register-scan--found");
    expect(found).toContain("register-scan__stamp--yes");
    expect(found).toContain("On the register");
    expect(found).toContain("Asha Rao");
    expect(found).not.toContain("register-scan__stamp--no");

    const searching = renderToStaticMarkup(<RegisterBook state="searching" />);
    expect(searching).not.toContain("register-scan__stamp");
    expect(searching).not.toContain("register-scan__hit");
  });

  it("stamps not found", () => {
    const missing = renderToStaticMarkup(<RegisterBook state="not-found" />);
    expect(missing).toContain("register-scan__stamp--no");
    expect(missing).toContain("Not found");
    expect(missing).not.toContain("register-scan__stamp--yes");
  });

  it("streams only made-up, masked records", () => {
    const idle = renderToStaticMarkup(<RegisterBook state="idle" />);
    const usns = [...idle.matchAll(/register-scan__usn">([^<]*)</g)].map((m) => m[1]);
    expect(usns.length).toBeGreaterThan(0);
    // Every USN in the stream is masked: none could be a real one.
    for (const usn of usns) expect(usn).toContain("•");
    // The same rows on the server and in the browser (no hydration mismatch).
    expect(renderToStaticMarkup(<RegisterBook state="idle" />)).toBe(idle);
  });

  it("says 'checking' and 'welcome back' when logging in", () => {
    expect(renderToStaticMarkup(<RegisterBook state="searching" tone="login" />)).toContain("Checking");
    expect(renderToStaticMarkup(<RegisterBook state="found" tone="login" />)).toContain("Welcome back");
  });

  it("folds away on a phone only while idle", () => {
    const css = readFileSync("app/styles/join-scan.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const folds = [...css.matchAll(/([^{}]+)\{\s*display:\s*none;?\s*\}/g)].map((m) => m[1]);
    expect(folds.length).toBeGreaterThan(0);
    for (const selectors of folds) {
      for (const selector of selectors.split(",")) expect(selector, selector).toContain("--idle");
    }
    // The old page-turning register is gone from join.css.
    expect(readFileSync("app/styles/join.css", "utf8")).not.toContain("register-book");
  });
});
