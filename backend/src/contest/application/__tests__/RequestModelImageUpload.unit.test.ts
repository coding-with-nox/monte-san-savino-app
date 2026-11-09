import { describe, it, expect } from "bun:test";
import { InvalidImageContentTypeError, RequestModelImageUpload } from "../RequestModelImageUpload";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("RequestModelImageUpload", () => {
  it("uses a random key with allowlisted extension and passes maxBytes", async () => {
    const calls: any[] = [];
    const storage = { getUploadUrl: async (i: any) => { calls.push(i); return { uploadUrl: "u", publicUrl: "p" }; } };
    const uc = new RequestModelImageUpload(storage, 1234);
    await uc.execute({ modelId: ID, contentType: "image/png" });
    await uc.execute({ modelId: ID, contentType: "image/png" });
    expect(calls[0].key).toMatch(new RegExp(`^models/${ID}/[0-9a-f-]{36}\\.png$`));
    expect(calls[0].key).not.toBe(calls[1].key);
    expect(calls[0].maxBytes).toBe(1234);
    expect(calls[0].contentType).toBe("image/png");
  });
  it("rejects disallowed content types", async () => {
    const uc = new RequestModelImageUpload({ getUploadUrl: async () => ({ uploadUrl: "", publicUrl: "" }) });
    await expect(uc.execute({ modelId: ID, contentType: "text/html" })).rejects.toBeInstanceOf(InvalidImageContentTypeError);
  });
});
