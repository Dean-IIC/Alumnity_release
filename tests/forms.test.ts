import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * A form handled in the browser can still be sent by the browser itself, before the page's
 * script has started (a slow phone, a quick tap). With no method that's a GET: the password
 * or code lands in the address, the history and the server's logs. So every form that asks
 * for one says method="post", where a too-early send keeps them in the body.
 */
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));

describe("forms that ask for a password or a code", () => {
  it("are all sent by POST", () => {
    const secret = /PasswordField|CodeField|type="password"/;
    const checked = files("components").filter((f) => secret.test(readFileSync(f, "utf8")) && !f.endsWith("fields.tsx"));
    expect(checked.length).toBeGreaterThanOrEqual(5);
    for (const file of checked) {
      const forms = readFileSync(file, "utf8").match(/<form\b[^>]*?(?=onSubmit|>)/g) ?? [];
      expect(forms.length, file).toBeGreaterThan(0);
      for (const form of forms) expect(form, file).toContain('method="post"');
    }
  });
});
