import { Elysia, t } from "elysia";
import QRCode from "qrcode";

export const qrRoutes = new Elysia({ prefix: "/qr" })
  .get("/:enrollmentId", async ({ params, set }) => {
    const payload = `enrollment:${params.enrollmentId}`;
    const svg = await QRCode.toString(payload, { type: "svg", margin: 1 });
    set.headers["content-type"] = "image/svg+xml";
    return svg;
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    detail: {
      summary: "QR code iscrizione (SVG)",
      tags: ["Staff"]
    }
  })
  .get("/:enrollmentId/png", async ({ params, set }) => {
    const payload = `enrollment:${params.enrollmentId}`;
    const buffer = await QRCode.toBuffer(payload, { type: "png", margin: 1, width: 300 });
    set.headers["content-type"] = "image/png";
    return buffer;
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    detail: {
      summary: "QR code iscrizione (PNG)",
      tags: ["Staff"]
    }
  })
  .get("/:enrollmentId/data", ({ params }) => {
    return { enrollmentId: params.enrollmentId, qrPayload: `enrollment:${params.enrollmentId}` };
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    detail: {
      summary: "QR payload iscrizione (JSON)",
      tags: ["Staff"]
    }
  });
