import { ImageResponse } from "next/og";

// Image metadata — iOS expects 180x180 PNG for the home-screen icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Generated at request time. Mirrors app/icon.svg (a stylized "M") but
// rasterized at the size iOS needs. Edge runtime keeps the response fast.
export const runtime = "edge";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#fafafa",
        fontSize: 124,
        fontWeight: 700,
        letterSpacing: -4,
        fontFamily: "system-ui",
      }}
    >
      M
    </div>,
    size
  );
}
