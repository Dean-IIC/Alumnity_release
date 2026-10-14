/** POST JSON to one of our own endpoints; every answer is { ok, error? , … }. */
export async function post<T extends object = object>(url: string, body: object): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return await response.json();
  } catch {
    return { ok: false, error: "We couldn’t reach Alumnity. Check your connection and try again." };
  }
}
