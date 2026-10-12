"""
Alpha 4 — alumni directory extraction.

Reads the college portal's own admin directory export and writes:

  1. directory.csv       — one row per member, joined onto the college's own
                           passout record where the USN matches, so every person
                           in the prototype is both a real member AND verifiably
                           a real graduate.
  2. directory-summary.json — top employers, cities, branches, graduation years.
                              The prototype draws its numbers from here so the
                              routing screens look like the real college.

Source of truth: Parameterized_Report_01_Oct_2026.xls, exported from the
college's own admin account (alumni.hkbk.edu.in -> admin -> directory).

Run:  python extract-directory.py
"""

import csv
import json
import pathlib
import re
from collections import Counter

import xlrd

HERE = pathlib.Path(__file__).parent
SRC = (
    HERE.parents[2]
    / "hkbk-alumni-v3" / "webscraping" / "OldHkbkAlumni" / "raw" / "original-export"
    / "Parameterized_Report_01_Oct_2026.xls"
)
RECORDS = HERE / "college-records.csv"

# Same normalisation as extract-records.py — the portal's own branch strings.
BRANCH = {
    "cse": "CSE", "computer science": "CSE", "computer science & engineering": "CSE",
    "computer science and engineering": "CSE",
    "ece": "ECE", "electronics": "ECE", "electronics and communication": "ECE",
    "electronics & communication": "ECE",
    "ise": "ISE", "information science": "ISE",
    "me": "MECH", "mech": "MECH", "mechanical": "MECH",
    "cv": "CIVIL", "civil": "CIVIL",
    "eee": "EEE", "electrical": "EEE",
    "ai & ml": "AIML", "ml": "AIML", "aiml": "AIML",
    "mba": "GEN",
}
NON_PERSON_ROLES = {"admin", "superadmin", "systemadmin"}


def txt(v) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()


def as_year(v):
    """Year columns come through as '2019' or '2019.0'."""
    s = txt(v).split(".")[0]
    return int(s) if s.isdigit() and len(s) == 4 else None


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"source export not found: {SRC}")

    # USN -> graduate record, so we can attach branch and passout year.
    # The portal only populates Enrollment Number for 8.6% of members, so we also
    # index by normalised name. Names in the passout sheet carry stray dots
    # ("Deepa .T.P"); the normaliser drops them so both sides agree.
    def norm_name(s: str) -> str:
        s = re.sub(r"[^a-z ]", " ", s.lower())
        return re.sub(r"\s+", " ", s).strip()

    by_usn: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    if RECORDS.exists():
        with RECORDS.open(encoding="utf-8-sig") as fh:
            for r in csv.DictReader(fh):
                key_usn = r["usn"].strip().upper()
                if key_usn:
                    by_usn[key_usn] = r
                by_name.setdefault(norm_name(r["name"]), r)

    book = xlrd.open_workbook(str(SRC), ignore_workbook_corruption=True)
    sheet = book.sheet_by_index(0)

    header = [txt(sheet.cell_value(1, c)).lower() for c in range(sheet.ncols)]
    col = {h: i for i, h in enumerate(header)}

    def get(row, name):
        return txt(sheet.cell_value(row, col[name])) if name in col else ""

    people: list[dict] = []
    match_source = Counter()
    for r in range(2, sheet.nrows):
        first, last = get(r, "first name"), get(r, "last name")
        name = f"{first} {last}".strip() if last else first
        role = get(r, "role")
        if not name or role.lower() in NON_PERSON_ROLES:
            continue

        usn = get(r, "enrollment number").upper()
        rec = by_usn.get(usn)
        how = "usn"
        if not rec:
            rec = by_name.get(norm_name(name))
            how = "name"
        if not rec:
            how = ""
        if how:
            match_source[how] += 1

        portal_branch = get(r, "branch")
        branch = (
            (rec["branch"] if rec else None)
            or BRANCH.get(portal_branch.lower())
            or None
        )

        # Work history: Work 1 is the current role, Work 2 the one before it.
        work = [
            {"company": get(r, f"work {n}: company"), "title": get(r, f"work {n}: designation"),
             "from": as_year(get(r, f"work {n}: start")), "to": as_year(get(r, f"work {n}: end"))}
            for n in (1, 2)
        ]
        work = [w for w in work if w["company"] or w["title"]]
        current = work[0] if work else {}

        people.append({
            "name": name,
            "usn": usn,
            "verified": "yes" if rec else "no",
            "matched_on": how,
            "role_type": role,
            "branch": branch or "",
            "branch_portal": portal_branch,
            "degree": get(r, "degree"),
            "grad_year": (rec or {}).get("year") or as_year(get(r, "year of graduation")) or "",
            "company": current.get("company", ""),
            "title": current.get("title", ""),
            "prev_company": work[1]["company"] if len(work) > 1 else "",
            "city": get(r, "current city"),
            "state": get(r, "state"),
            "country": get(r, "country"),
            "email": get(r, "e-mail"),
            "linkedin": get(r, "linkedin profile url"),
            "photo": get(r, "profile pic url"),
        })

    out = HERE / "directory.csv"
    with out.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(people[0]))
        w.writeheader()
        w.writerows(people)

    employers = Counter(p["company"] for p in people if p["company"])
    cities = Counter(p["city"] for p in people if p["city"])
    branches = Counter(p["branch"] for p in people if p["branch"])
    years = Counter(p["grad_year"] for p in people if p["grad_year"])
    verified = sum(1 for p in people if p["verified"] == "yes")

    summary = {
        "source": SRC.name,
        "members": len(people),
        "matched_to_passout_records": verified,
        "match_rate": round(verified / len(people), 3),
        "with_current_employer": sum(1 for p in people if p["company"]),
        "with_city": sum(1 for p in people if p["city"]),
        "with_photo": sum(1 for p in people if p["photo"]),
        "top_employers": employers.most_common(30),
        "top_cities": cities.most_common(20),
        "branches": branches.most_common(),
        "grad_years": sorted(years.items(), key=lambda kv: -kv[1])[:15],
    }
    (HERE / "directory-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"{len(people)} members -> {out.name}")
    print(f"matched to college records: {verified} ({summary['match_rate']:.1%}) {dict(match_source)}")
    print(f"with employer {summary['with_current_employer']}, city {summary['with_city']}, photo {summary['with_photo']}")
    print("top employers:", employers.most_common(12))
    print("branches:", branches.most_common())
    print("top cities:", cities.most_common(8))


if __name__ == "__main__":
    main()