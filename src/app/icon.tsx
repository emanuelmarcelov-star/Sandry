import { ImageResponse } from "next/og";

/** Íconos de la app (los que se ven en la pantalla de inicio del celular). */
export function generateImageMetadata() {
  return [192, 512].map((lado) => ({
    id: String(lado),
    contentType: "image/png",
    size: { width: lado, height: lado },
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const lado = Number(await id);
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
          fontSize: lado * 0.62,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    { width: lado, height: lado },
  );
}
