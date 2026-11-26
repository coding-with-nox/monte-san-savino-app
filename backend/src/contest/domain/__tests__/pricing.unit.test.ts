import { describe, it, expect } from "bun:test";
import { computePricing, formatEuro, parseBaseFeeCents, type PricingModel } from "../pricing";

const member = (priceCents = 1500) => ({ name: "Ada", surname: "Neri", roleId: "r1", roleName: "Pittore", priceCents });
const model = (id: string, over: Partial<PricingModel> = {}): PricingModel => ({
  modelId: id, modelName: id, modelCode: null, free: false, members: [], ...over
});

describe("computePricing", () => {
  it("is zero without models", () => {
    expect(computePricing({ baseFeeCents: 2500, models: [] }).totalCents).toBe(0);
  });

  it("charges the base fee once for 1 or 50 models", () => {
    expect(computePricing({ baseFeeCents: 2500, models: [model("a")] }).totalCents).toBe(2500);
    const fifty = Array.from({ length: 50 }, (_, i) => model(String(i)));
    expect(computePricing({ baseFeeCents: 2500, models: fifty }).totalCents).toBe(2500);
  });

  it("adds each coauthor with its role price", () => {
    const s = computePricing({
      baseFeeCents: 2500,
      models: [model("a", { members: [member(), member(1000)] }), model("b", { members: [member()] })]
    });
    expect(s.coauthorLines).toHaveLength(3);
    expect(s.coauthorsTotalCents).toBe(4000);
    expect(s.totalCents).toBe(6500);
  });

  it("is free when all models are free, coauthors included", () => {
    const s = computePricing({ baseFeeCents: 2500, models: [model("a", { free: true, members: [member()] })] });
    expect(s).toMatchObject({ baseFeeCents: 0, coauthorLines: [], totalCents: 0, paidModelCount: 0, modelCount: 1 });
    expect(s.freeModels.map((m) => m.modelId)).toEqual(["a"]);
  });

  it("mixes free and paid models", () => {
    const s = computePricing({
      baseFeeCents: 2500,
      models: [model("a", { free: true, members: [member()] }), model("b", { members: [member()] })]
    });
    expect(s.totalCents).toBe(4000);
    expect(s.currency).toBe("EUR");
  });
});

describe("parseBaseFeeCents / formatEuro", () => {
  it("accepts non-negative integers only", () => {
    expect(parseBaseFeeCents("0")).toBe(0);
    expect(parseBaseFeeCents("3000")).toBe(3000);
    for (const v of [undefined, null, "", "-1", "25.5", "abc"]) expect(parseBaseFeeCents(v)).toBe(2500);
  });

  it("formats cents as euro", () => {
    expect(formatEuro(6500)).toBe("€ 65,00");
    expect(formatEuro(5)).toBe("€ 0,05");
  });
});
