import { Elysia, t } from "elysia";

export const qrRoutes = new Elysia({ prefix: "/qr" })
  .get("/:enrollmentId", ({ params }) => {
    return { enrollmentId: params.enrollmentId, qrPayload: `enrollment:${params.enrollmentId}` };
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    detail: {
      summary: "QR payload iscrizione",
      tags: ["Public"]
    }
  });
