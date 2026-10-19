/** HKBK's branches as the register names them (code, and a short name for filters). */
export const BRANCHES = [
  ["CSE", "Computer Science"],
  ["ECE", "Electronics & Communication"],
  ["MECH", "Mechanical"],
  ["ISE", "Information Science"],
  ["EEE", "Electrical & Electronics"],
  ["CIVIL", "Civil"],
  ["AIML", "AI & Machine Learning"]
  // MBA ("GEN") is left out of the network: see LEFT_OUT in lib/server/register.ts.
] as const;

export const isBranch = (code: unknown): code is string => BRANCHES.some(([c]) => c === code);
