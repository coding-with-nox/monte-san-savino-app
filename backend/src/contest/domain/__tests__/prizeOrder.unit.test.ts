import { describe, it, expect } from "bun:test";
import { parsePrizeOrder, DEFAULT_PRIZE_ORDER } from "../prizeOrder";

describe("parsePrizeOrder", () => {
  it("defaults to the ascending medal order", () => {
    for (const v of [undefined, "", "[]", "{}", "[1]"]) expect(parsePrizeOrder(v)).toEqual([...DEFAULT_PRIZE_ORDER]);
  });

  it("keeps the stored order without duplicates", () => {
    expect(parsePrizeOrder('["Gold","Bronze","Gold"]')).toEqual(["Gold", "Bronze"]);
  });
});
