/** What a form's server action answers: shown under the form (an error, or a short "done"). */
export type ActionState = { ok: boolean; error?: string; message?: string } | null;
