import { describe, it, expect } from "bun:test";
import { nextTeamCode } from "../teamCode";

describe("nextTeamCode", () => {
  it("starts at 1", () => {
    expect(nextTeamCode(173, [])).toBe("173T1");
    expect(nextTeamCode(173, [null, undefined])).toBe("173T1");
  });

  it("continues from the highest progressive of the same participant", () => {
    expect(nextTeamCode(173, ["173T1", "173T4", "17T9"])).toBe("173T5");
  });
});
