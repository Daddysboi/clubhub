"use client";

import { useEffect } from "react";

const colors = {
  paper: "#0b1220",
  surface: "#121c2d",
  ink: "#f8fafc",
  ink2: "#cbd5e1",
  rule: "#263349",
  pitch: "#4ade80",
};

/**
 * Replaces the root layout when even the layout fails, so it must carry its
 * own document and styles. No app CSS, fonts or metadata are available here.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong · ClubHub</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: colors.paper,
          color: colors.ink2,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main
          style={{
            maxWidth: 560,
            minHeight: "100vh",
            margin: "0 auto",
            padding: "15vh 1.25rem 2rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: colors.pitch,
            }}
          >
            ClubHub
          </p>
          <h1 style={{ margin: "0.75rem 0 0", color: colors.ink, fontSize: 32, lineHeight: 1.1 }}>
            Something went wrong
          </h1>
          <p role="alert" style={{ margin: "1rem 0 0", lineHeight: 1.6 }}>
            The app hit an unexpected error. Try again, or return to the home page.
          </p>
          <div
            style={{
              marginTop: "1.75rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={retry}
              style={{
                minHeight: 44,
                padding: "0 1.25rem",
                border: 0,
                borderRadius: 10,
                background: colors.pitch,
                color: colors.paper,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the root layout, so there is no router context for Link. */}
            <a
              href="/"
              style={{
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 1.25rem",
                border: `1px solid ${colors.rule}`,
                borderRadius: 10,
                background: colors.surface,
                color: colors.ink2,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
