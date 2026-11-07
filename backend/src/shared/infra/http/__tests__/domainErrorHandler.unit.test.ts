import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { domainErrorHandler, mapErrorToResponse } from "../domainErrorHandler";
import { CategoryClosedError, ConflictError, ForbiddenError, IncompleteVotesError, NotFoundError } from "../../../../contest/domain/errors";

describe("mapErrorToResponse", () => {
  it("maps typed errors", () => {
    expect(mapErrorToResponse(new NotFoundError("x"))?.status).toBe(404);
    expect(mapErrorToResponse(new ForbiddenError())?.status).toBe(403);
    expect(mapErrorToResponse(new ConflictError())?.status).toBe(409);
    expect(mapErrorToResponse(new CategoryClosedError())).toMatchObject({ status: 409, body: { code: "CATEGORY_CLOSED" } });
    expect(mapErrorToResponse(new IncompleteVotesError(2, 5, ["a"]))?.body).toMatchObject({ code: "INCOMPLETE_VOTES", missing: 2, totalModels: 5 });
    expect(String(mapErrorToResponse(new IncompleteVotesError(2, 5, ["a"]))?.body.error)).toContain("2");
  });
  it("maps pg unique violations (also wrapped in cause) to 409", () => {
    expect(mapErrorToResponse({ code: "23505" })?.status).toBe(409);
    expect(mapErrorToResponse(Object.assign(new Error("wrapped"), { cause: { code: "23505" } }))?.status).toBe(409);
  });
  it("ignores unknown errors", () => {
    expect(mapErrorToResponse(new Error("boom"))).toBeNull();
    expect(mapErrorToResponse({ code: "ECONNRESET" })).toBeNull();
  });
});

describe("domainErrorHandler plugin", () => {
  const app = new Elysia()
    .use(domainErrorHandler)
    .get("/nf", () => { throw new NotFoundError("Model not found"); })
    .get("/closed", () => { throw new CategoryClosedError(); })
    .get("/dup", () => { throw Object.assign(new Error("dup"), { code: "23505" }); })
    .get("/boom", () => { throw new Error("boom"); });
  it("returns 404 / 409 json", async () => {
    const nf = await app.handle(new Request("http://localhost/nf"));
    expect(nf.status).toBe(404);
    expect(await nf.json()).toMatchObject({ error: "Model not found", code: "NOT_FOUND" });
    expect((await app.handle(new Request("http://localhost/closed"))).status).toBe(409);
    expect((await app.handle(new Request("http://localhost/dup"))).status).toBe(409);
  });
  it("leaves unknown errors as 500", async () => {
    expect((await app.handle(new Request("http://localhost/boom"))).status).toBe(500);
  });
});
