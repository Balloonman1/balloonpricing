import { ImageResponse } from "next/og";

export const alt = "Balloon Bluebook: know what your balloon is really worth";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#12243f", color: "#f6f2e8", padding: 72 }}>
        <div style={{ fontSize: 34, display: "flex" }}>Balloon Bluebook</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, maxWidth: 900 }}>What&rsquo;s your hot air balloon really worth?</div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#cfc6b4" }}>Transparent used balloon valuations from a consistent pricing method.</div>
        </div>
        <div style={{ width: 120, height: 8, background: "#c05f2a", display: "flex" }} />
      </div>
    ),
    size,
  );
}
