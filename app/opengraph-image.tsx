import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt =
  "Field Notes by Jordan Lyall — small compositions, made to be shared.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#faf9f5",
          color: "#141413",
          display: "flex",
          flexDirection: "column",
          padding: "64px 72px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 20,
            letterSpacing: "3px",
            color: "#8a8a83",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Jordan Lyall
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-2px",
              color: "#141413",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div>Small compositions,</div>
            <div>made to be shared.</div>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 28,
              color: "#6b6b64",
              lineHeight: 1.4,
              maxWidth: 720,
              display: "flex",
            }}
          >
            On-chain glyph grids. Free to make. Sent by link.
          </div>
        </div>

        {/* Accent strip — three small marks in the Paper palette inks */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: "#141413",
                letterSpacing: "-0.5px",
              }}
            >
              Field Notes
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                paddingLeft: 20,
                borderLeft: "1px solid #d9d4c4",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9999,
                  background: "#d97757",
                }}
              />
              <div
                style={{
                  width: 18,
                  height: 18,
                  border: "2px solid #141413",
                }}
              />
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9999,
                  border: "2px solid #6a9bcc",
                }}
              />
            </div>
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#6b6b64",
            }}
          >
            toss.lol
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
