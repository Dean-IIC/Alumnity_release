import Link from "next/link";
import { pieces } from "../../lib/mentions";
import { tagPieces } from "../../lib/tags";

/**
 * Post or comment text: plain text, with @mentions as links to the member (name as text,
 * id as a number only) and #tags as links to the HKBK board for that tag.
 */
export function RichText({ body }: { body: string }) {
  return (
    <>
      {pieces(body).map((p, i) =>
        "text" in p ? (
          tagPieces(p.text).map((t, j) =>
            "text" in t ? (
              <span key={`${i}-${j}`}>{t.text}</span>
            ) : (
              <Link key={`${i}-${j}`} className="hashtag" href={`/board?tag=${t.tag}`}>
                {t.shown}
              </Link>
            )
          )
        ) : (
          <Link key={i} className="mention" href={`/people/${p.mention.id}`}>
            @{p.mention.name}
          </Link>
        )
      )}
    </>
  );
}
