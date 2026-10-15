/** HKBK's branches as the register names them (code, and a short name for filters). */
export const BRANCHES = [
  ["CSE", "Computer Science"],
  ["ECE", "Electronics & Communication"],
  ["MECH", "Mechanical"],
  ["ISE", "Information Science"],
  ["EEE", "Electrical & Electronics"],
  ["CIVIL", "Civil"],
  ["AIML", "AI & Machine Learning"],
  ["GEN", "MBA"]
] as const;

export const isBranch = (code: unknown): code is string => BRANCHES.some(([c]) => c === code);
