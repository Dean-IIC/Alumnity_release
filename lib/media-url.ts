/**
 * Where a member's upload is served. Uploads never change (a new one gets a new id), so
 * browsers keep them a day; the version moves when how they're served changes, so nobody
 * is left with a copy served the old way.
 */
const VERSION = 2;

export const mediaUrl = (id: string) => `/media/${id}?v=${VERSION}`;
