"use client";

import { useEffect } from "react";

/*
 * When a page couldn't be made (the database didn't answer in time, a network blip): say
 * so plainly, and try again, rather than leave a broken page.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="container page-error" id="main">
      <h1>This page didn’t load.</h1>
      <p>Something went wrong on our side. Please try again in a moment.</p>
      <p>Still not working? Write to the alumni office.</p>
      <div className="page-error__actions">
        <button type="button" className="button button--primary" onClick={() => reset()}>
          Try again
        </button>
        <a className="button button--secondary" href="/home">
          Go to Home
        </a>
      </div>
      {error.digest && <p className="page-error__ref">Error code: {error.digest}</p>}
    </main>
  );
}
