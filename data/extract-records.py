"""
Alpha 4 — college records extraction.

Reads the official passout spreadsheet and writes two things:

  1. college-records.csv   — every graduate the college actually knows about.
                             This is the verification backbone: a person can only
                             join by matching a row here (name + USN + branch + year).
  2. cohort-summary.json   — counts per branch and per passout year, for the
                             prototype to draw real numbers from.

Source of truth: "Academic year 1998 to 2022 Batch Passout Details.xls",
Department of Examination, HKBK College of Engineering.

Run:  python extract-records.py
"""

import csv
import json
import pathlib
import re
from collections import Counter, defaultdict

import xlrd

HERE = pathlib.Path(__file__).parent
SRC = HERE.parents[2] / "hkbk-alumni-v3" / "Academic year 1998 to 2022 Batch Passout Details.xls"

# The sheet is inconsistent: CSE/ECE/ISE/EEE are clean, but the mechanical code
# arrives as ME/me/Me, civil as CV/Civil, and AI & ML appears alongside ML.
# Keys are lowercased on load, so matching is case-insensitive.
DEPT = {
    "cse": ("CSE", "Computer Science & Engineering"),
    "ece": ("ECE", "Electronics & Communication"),
    "ise": ("ISE", "Information Science & Engineering"),
    "me": ("MECH", "Mechanical Engineering"),
    "mech": ("MECH", "Mechanical Engineering"),
    "mechanical": ("MECH", "Mechanical Engineering"),
    "cv": ("CIVIL", "Civil Engineering"),
    "civil": ("CIVIL", "Civil Engineering"),
    "eee": ("EEE", "Electrical & Electronics"),
    "ml": ("AIML", "Artificial Intelligence & Machine Learning"),
    "ai & ml": ("AIML", "Artificial Intelligence & Machine Learning"),
    "ai&ml": ("AIML", "Artificial Intelligence & Machine Learning"),
}
BRANCH_NAME = {code: name for code, name in DEPT.values()}

# The PG MBA sheet records "MBA" in the Department column, where it is really the
# programme. Keep it as its own cohort rather than folding it into a branch.
PROGRAMMES = {"mba": "MBA", "pg mba": "MBA"}
UNMAPPED = Counter()

# USN looks like 1HK98CS001. The college opened in 1998, so the founding cohorts
# read 98/99 and everything after is 1HK00 upwards.
USN_YEAR = re.compile(r"^1HK(\d{2})")


def clean_name(raw: str) -> str:
    """The sheet has stray dots from the source system: 'Deepa .T.P'."""
    s = re.sub(r"\s*\.\s*", ". ", raw)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\.(?=\s|$)", "", s)  # drop a dangling separator
    return re.sub(r"\s+", " ", s).strip(" .")


def year_from_usn(usn: str):
    """1HK98 -> 1998, 1HK00 -> 2000. yy >= 90 is a founding cohort."""
    m = USN_YEAR.match(usn)
    if not m:
        return None
    yy = int(m.group(1))
    return (1900 if yy >= 90 else 2000) + yy


def parse_year_column(raw: str):
    """'Completed' and Excel serials both appear. Excel date serial 41091 = 2012-06."""
    raw = (raw or "").strip()
    if not raw:
        return None
    if raw.isdigit() and len(raw) > 3:
        try:
            return xlrd.xldate_as_tuple(float(raw), 0)[0]
        except Exception:
            return None
    m = re.search(r"(\d{4})", raw)
    return int(m.group(1)) if m else None


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"source spreadsheet not found: {SRC}")

    book = xlrd.open_workbook(str(SRC))
    rows: list[dict] = []

    for sheet_name in book.sheet_names():
        sheet = book.sheet_by_name(sheet_name)
        programme = "B.Tech" if sheet_name.startswith("UG") else sheet_name.replace("PG ", "").strip()
        header_row = next(
            (r for r in range(min(8, sheet.nrows))
             if str(sheet.cell_value(r, 1)).strip().startswith("Name of the Student")),
            None,
        )
        if header_row is None:
            continue

        for r in range(header_row + 1, sheet.nrows):
            name = clean_name(str(sheet.cell_value(r, 1)))
            usn = str(sheet.cell_value(r, 2)).strip()
            if not name or name.lower() in {"total", "grand total"}:
                continue

            raw_dept = str(sheet.cell_value(r, 8)).strip()
            key = raw_dept.lower()

            if key in PROGRAMMES:
                # A whole-programme cohort (the MBA sheet). No engineering branch.
                rows.append({
                    "name": name,
                    "usn": usn,
                    "branch": "GEN",
                    "branch_name": "General / MBA",
                    "programme": "MBA",
                    "year": year_from_usn(usn) or parse_year_column(str(sheet.cell_value(r, 6))),
                })
                continue

            code = DEPT.get(key, (None, None))[0]
            if code is None:
                UNMAPPED[raw_dept] += 1
                continue

            rows.append({
                "name": name,
                "usn": usn,
                "branch": code,
                "branch_name": BRANCH_NAME[code],
                "programme": programme,
                "year": year_from_usn(usn) or parse_year_column(str(sheet.cell_value(r, 6))),
            })

    out_csv = HERE / "college-records.csv"
    with out_csv.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    by_branch = Counter(r["branch"] for r in rows)
    by_year = defaultdict(Counter)
    for r in rows:
        by_year[r["year"]][r["branch"]] += 1

    summary = {
        "source": SRC.name,
        "total": len(rows),
        "branches": {c: {"name": n, "count": by_branch[c]} for c, n in DEPT.values() if by_branch[c]},
        "by_year": {str(y): dict(c) for y, c in sorted(by_year.items()) if y},
        "first_year": min(r["year"] for r in rows if r["year"]),
        "last_year": max(r["year"] for r in rows if r["year"]),
        "unmapped_departments": dict(UNMAPPED),
    }
    (HERE / "cohort-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"{len(rows)} records -> {out_csv.name}")
    print(f"branches: {dict(by_branch)}")
    print(f"years: {summary['first_year']}-{summary['last_year']}")
    if UNMAPPED:
        print(f"skipped unmapped departments: {dict(UNMAPPED)}")


if __name__ == "__main__":
    main()