import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícono para iPhone ("Agregar a pantalla de inicio" en Safari). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15803d",
          color: "#ffffff",
          fontSize: 112,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
