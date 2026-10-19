"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "../action-state";
import { ALBUM_LIMITS, createAlbum, deleteAlbum, deletePhoto, movePhoto, setCover, updateAlbum, updatePhoto, type AlbumInput } from "../server/showcase";
import { savePage } from "../server/site-pages";
import { PAGE_LIMITS } from "../site-pages";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* The college desk's Showcase tab: the gallery's albums and the college's pages. The rules
 * (lib/server/showcase.ts, lib/server/site-pages.ts) check the role every time. */

const albumFrom = (form: FormData): AlbumInput => ({
  title: textFrom(form, "title", ALBUM_LIMITS.title),
  date: textFrom(form, "date", 10),
  when: textFrom(form, "when", ALBUM_LIMITS.when),
  about: textFrom(form, "about", ALBUM_LIMITS.about),
  published: form.get("published") === "on"
});

export async function createAlbumAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const made = await createAlbum(me, albumFrom(form));
  if (!made.ok) return answer(made);
  answer(made);
  redirect(`/desk?tab=showcase&album=${made.id}`);
}

export async function updateAlbumAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await updateAlbum(me, idFrom(form), albumFrom(form)), "Album saved.");
}

export async function deleteAlbumAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const done = await deleteAlbum(me, idFrom(form));
  if (!done.ok) return answer(done);
  answer(done);
  redirect("/desk?tab=showcase");
}

export async function updatePhotoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await updatePhoto(me, idFrom(form), { alt: textFrom(form, "alt", ALBUM_LIMITS.alt), caption: textFrom(form, "caption", ALBUM_LIMITS.caption) }), "Saved.");
}

export async function movePhotoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await movePhoto(me, idFrom(form), textFrom(form, "by", 5) === "-1" ? -1 : 1));
}

export async function coverAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await setCover(me, idFrom(form)), "This photo is now the cover.");
}

export async function deletePhotoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await deletePhoto(me, idFrom(form)), "Photo deleted.");
}

export async function savePageAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(
    await savePage(me, textFrom(form, "slug", 60), {
      body: textFrom(form, "body", PAGE_LIMITS.body),
      signerName: textFrom(form, "signerName", PAGE_LIMITS.signer),
      signerRole: textFrom(form, "signerRole", PAGE_LIMITS.signer)
    }),
    "Saved. The page shows the new words now."
  );
}
