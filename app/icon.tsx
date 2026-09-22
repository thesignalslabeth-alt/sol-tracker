import { ImageResponse } from "next/og";

export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<Glyph size={size} />, { width: size, height: size });
}

export function Glyph({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #9945ff 0%, #14f195 100%)",
        color: "white",
        fontSize: size * 0.34,
        fontWeight: 700,
        letterSpacing: -size * 0.01,
      }}
    >
      SOL
    </div>
  );
}
