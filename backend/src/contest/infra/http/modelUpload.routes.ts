import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { RequestModelImageUpload } from "../../application/RequestModelImageUpload";
import { MinioStorage } from "../../../shared/infra/storage/minioStorage";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";

export const modelUploadRoutes = new Elysia({ prefix: "/models" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .post("/:modelId/image-upload", async ({ params, body }) => {
    return await new RequestModelImageUpload(new MinioStorage()).execute({ modelId: params.modelId, contentType: body.contentType });
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({ contentType: t.String() }),
    detail: {
      summary: "Richiedi upload immagine",
      description: "Restituisce una URL firmata per caricare l'immagine del modello.",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    },
    response: {
      200: t.Object({ uploadUrl: t.String(), publicUrl: t.String() })
    }
  });
