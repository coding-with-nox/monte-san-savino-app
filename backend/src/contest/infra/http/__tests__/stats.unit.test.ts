import { describe, it, expect } from "bun:test";
import { buildStatsOverview, type StatsInput } from "../stats.routes";

const base: StatsInput = { users: [], models: [], categories: [], awards: [], mentions: [] };

describe("buildStatsOverview", () => {
  it("handles empty input", () => {
    const r = buildStatsOverview(base);
    expect(r.usersTotal).toBe(0);
    expect(r.usersByCountry).toEqual([]);
    expect(r.modelsPerUser).toEqual([]);
    expect(r.zeroModelUsers).toEqual([]);
  });

  const input: StatsInput = {
    users: [
      { id: "u1", email: "a@x.it", firstName: "Anna", lastName: "Rossi", country: "IT" },
      { id: "u2", email: "b@x.it", firstName: null, lastName: null, country: " " },
      { id: "u3", email: "c@x.it", firstName: "Carl", country: "DE" },
      { id: "u4", email: "d@x.it", country: "IT" }
    ],
    models: [
      { userId: "u1", categoryId: "c1" }, { userId: "u1", categoryId: "c1" },
      { userId: "u3", categoryId: "c2" }
    ],
    categories: [{ id: "c1", name: "A" }, { id: "c2", name: "B" }, { id: "c3", name: "Empty" }],
    awards: [{ medalLabel: "Oro" }, { medalLabel: "Argento" }, { medalLabel: "Oro" }],
    mentions: [{ title: "Best" }, { title: "Best" }, { title: "Other" }]
  };

  it("aggregates and sorts", () => {
    const r = buildStatsOverview(input);
    expect(r.usersTotal).toBe(4);
    expect(r.usersByCountry[0]).toEqual({ country: "IT", count: 2 });
    expect(r.usersByCountry.find((c) => c.country === "N/D")?.count).toBe(1);
    expect(r.modelsPerUser.map((u) => [u.userId, u.count])).toEqual([["u1", 2], ["u3", 1]]);
    expect(r.modelsPerUser[1].name).toBe("Carl");
    expect(r.modelsPerCategory.map((c) => c.count)).toEqual([2, 1, 0]);
    expect(r.medals[0]).toEqual({ name: "Oro", count: 2 });
    expect(r.honorsSummary[0]).toEqual({ title: "Best", count: 2 });
  });

  it("lists zero-model users with email fallback as name", () => {
    const r = buildStatsOverview(input);
    expect(r.zeroModelUsers).toEqual([
      { userId: "u2", name: "b@x.it", email: "b@x.it" },
      { userId: "u4", name: "d@x.it", email: "d@x.it" }
    ]);
  });
});
