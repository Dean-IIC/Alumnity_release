import type { Role, User } from "./auth";

/*
 * The ladder every permission is decided on. Members (students, alumni) at the bottom;
 * faculty can put up events; coordinators run the college desk; administrators manage
 * people's roles; super administrators (named only in the server's config, so nobody can
 * remove them from the site) appoint administrators and change the site's settings.
 *
 * Anyone acting on another member (pausing, changing a role, signing them out) must stand
 * above them on the ladder, and can only give roles below their own.
 */
const RANK: Record<Role, number> = { student: 0, alumnus: 0, faculty: 1, coordinator: 2, admin: 3, superadmin: 4 };

export const rank = (role: Role) => RANK[role] ?? 0;
export const isModerator = (u: Pick<User, "role">) => rank(u.role) >= RANK.coordinator;
export const isAdmin = (u: Pick<User, "role">) => rank(u.role) >= RANK.admin;
export const isSuperAdmin = (u: Pick<User, "role">) => u.role === "superadmin";
export const canOrganise = (u: Pick<User, "role">) => rank(u.role) >= RANK.faculty;
/** Who may be asked, and take Asks on: those who've finished at HKBK, or teach there. */
export const isSenior = (u: Pick<User, "role">) => u.role !== "student";
/** Whether `a` stands above `b`, and so may act on them. */
export const outranks = (a: Pick<User, "role">, b: Pick<User, "role">) => rank(a.role) > rank(b.role);

/** The roles `me` may give: everything below their own (never super administrator: that's config only). */
export const assignable = (me: Pick<User, "role">): Role[] =>
  (["student", "alumnus", "faculty", "coordinator", "admin"] as Role[]).filter((r) => rank(r) < rank(me.role));
