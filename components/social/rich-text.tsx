import { pieces } from "../../lib/mentions";

/** Post or comment text: plain text, with @mentions as links to the member (name as text, id as a number only). */
export function RichText({ body }: { body: string }) {
  return (
    <>
      {pieces(body).map((p, i) =>
        "text" in p ? (
          <span key={i}>{p.text}</span>
        ) : (
          <a key={i} className="mention" href={`/people/${p.mention.id}`}>
            @{p.mention.name}
          </a>
        )
      )}
    </>
  );
}
