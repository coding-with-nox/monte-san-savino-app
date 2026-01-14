import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { RequestModelImageUpload } from "../../application/RequestModelImageUpload";
import { MinioStorage } from "../../../shared/infra/storage/minioStorage";

export const modelUploadRoutes = new Elysia({ prefix: "/models" })
  .use(requireRole("user"))
  .post("/:modelId/image-upload", async ({ params, body }) => {
    return await new RequestModelImageUpload(new MinioStorage()).execute({ modelId: params.modelId, contentType: body.contentType });
  }, { params: t.Object({ modelId: t.String() }), body: t.Object({ contentType: t.String() }) });
