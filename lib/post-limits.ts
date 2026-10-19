/*
 * Limits on a post that both the server and the composer need. Kept out of
 * lib/server/posts.ts so a browser component can import them without the database.
 */

/** Photos and videos one post may carry (WhatsApp and Facebook allow about this many). */
export const MEDIA_LIMIT = 10;

/** People one post may be sent to privately at once. */
export const SEND_LIMIT = 10;
