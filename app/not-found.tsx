import type { Metadata } from "next";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { currentUser } from "../lib/server/session";
import "./styles/wire.css";
import "./styles/info.css";

export const metadata: Metadata = { title: "Not found · Alumnity", robots: { index: false } };

/** An address that leads nowhere: say so kindly, in the site's own look, and offer the way on. */
export default async function NotFound() {
  const me = await currentUser();
  return (
    <>
      <SiteHeader />
      <main className="container info not-found" id="main">
        <header className="page-head">
          <p className="kicker">Page not found</p>
          <h1 className="page-title">
            This page <span className="page-title__gold">isn’t here.</span>
          </h1>
          <p className="page-head__text">The link may be old, or a letter may be out of place. Nothing’s wrong with your account.</p>
        </header>
        <div className="info-join__actions not-found__actions">
          {me ? (
            <>
              <a className="button button--primary" href="/home">
                Go to Home <span aria-hidden="true">→</span>
              </a>
              <a className="button button--secondary" href="/people">
                Find someone
              </a>
            </>
          ) : (
            <>
              <a className="button button--primary" href="/">
                Go to the start <span aria-hidden="true">→</span>
              </a>
              <a className="button button--secondary" href="/gallery">
                See the gallery
              </a>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
