import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POSTGRES_OPTIONS } from "../lib/server/db";

/*
 * Supabase's pooler (transaction mode) gives its server connection back as each query
 * ends, so a query sent down a connection behind another one is stranded (live, Home never
 * finished). This stands in for Postgres just enough to count how many queries are on one
 * connection at once: begun by the driver, not yet answered.
 */

const message = (type: string, body: Buffer = Buffer.alloc(0)) => {
  const head = Buffer.alloc(5);
  head.write(type, 0, "latin1");
  head.writeInt32BE(body.length + 4, 1);
  return Buffer.concat([head, body]);
};
const ready = () => message("Z", Buffer.from("I"));
const done = () => message("C", Buffer.from("SELECT 0\0"));
// A simple query (Q) gets its result; an extended one (ending in Sync) its bind too.
const answer = (simple: boolean) => Buffer.concat([...(simple ? [] : [message("2")]), done(), ready()]);
// A query with parameters is parsed and described first (ending in Flush): one int parameter, no rows.
const described = () => Buffer.concat([message("1"), message("t", Buffer.from([0, 1, 0, 0, 0, 23])), message("n")]);

let server: Server;
let port = 0;
let mostWaiting = 0;

function serve(socket: Socket) {
  let buffer = Buffer.alloc(0);
  let started = false;
  let waiting = 0;
  // Answered strictly in order, as Postgres does.
  let answering = Promise.resolve();
  const then = (work: () => void, ms = 0) => (answering = answering.then(() => new Promise<void>((ok) => setTimeout(() => (work(), ok()), ms))));
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (!started) {
        if (buffer.length < 4) return;
        const length = buffer.readInt32BE(0);
        if (buffer.length < length) return;
        buffer = buffer.subarray(length);
        started = true;
        socket.write(Buffer.concat([message("R", Buffer.from([0, 0, 0, 0])), ready()]));
        continue;
      }
      if (buffer.length < 5) return;
      const type = String.fromCharCode(buffer[0]);
      const length = buffer.readInt32BE(1);
      if (buffer.length < length + 1) return;
      buffer = buffer.subarray(length + 1);
      if (type === "X") return socket.end();
      if (type === "H") then(() => socket.write(described()));
      // A query starts arriving (simple: Q; with parameters: Parse)...
      if (type === "Q" || type === "P") mostWaiting = Math.max(mostWaiting, ++waiting);
      // ...and is answered once whole (Q, or Sync), a little later, as a busy server would.
      if (type === "Q" || type === "S") {
        then(() => {
          waiting--;
          socket.write(answer(type === "Q"));
        }, 30);
      }
    }
  });
}

beforeAll(async () => {
  server = createServer(serve);
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

async function mostQueriesAtOnceOnOneConnection(options: object) {
  mostWaiting = 0;
  const sql = postgres(`postgres://test@127.0.0.1:${port}/test`, { ...options, max: 1, fetch_types: false, ssl: false });
  // As Home asks: some queries without parameters (sent whole), some with (parsed, then bound).
  await Promise.all(Array.from({ length: 6 }, (_, i) => (i % 2 ? sql.unsafe("select 1") : sql.unsafe("select $1::int", [i]))));
  await sql.end({ timeout: 1 });
  return mostWaiting;
}

describe("talking to Supabase's pooler", () => {
  it("would send queries behind each other on one connection, left to the driver's default", async () => {
    expect(await mostQueriesAtOnceOnOneConnection({ prepare: false })).toBeGreaterThan(1);
  });

  it("sends one query at a time on each connection, as Alumnity sets it", async () => {
    expect(POSTGRES_OPTIONS.max_pipeline).toBe(0);
    expect(await mostQueriesAtOnceOnOneConnection(POSTGRES_OPTIONS)).toBe(1);
  });
});
