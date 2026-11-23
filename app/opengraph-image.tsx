import { ImageResponse } from "next/og";

export const alt = "ClubHub — tournament hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0b1220",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, color: "#4ade80" }}>
          CLUBHUB
        </div>
        <div style={{ marginTop: 24, fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>
          Every cup, one place.
        </div>
        <div style={{ marginTop: 24, fontSize: 32, color: "#cbd5e1" }}>
          Fixtures, standings and match-day memories.
        </div>
      </div>
    ),
    size,
  );
}
