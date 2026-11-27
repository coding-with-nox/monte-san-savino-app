import { describe, it, expect } from "bun:test";
import { buildStatsOverview, type StatsInput } from "../stats.routes";

const base: StatsInput = { usersByCountryRaw: [], users: [], modelsByUser: [], modelsByCategory: [], categories: [], awardsByMedal: [], mentionsByTitle: [] };

describe("buildStatsOverview", () => {
  it("handles empty input", () => {
    const r = buildStatsOverview(base);
    expect(r.usersTotal).toBe(0);
    expect(r.usersByCountry).toEqual([]);
    expect(r.modelsPerUser).toEqual([]);
    expect(r.zeroModelUsers).toEqual({ count: 0, list: [] });
  });

  const input: StatsInput = {
    usersByCountryRaw: [{ country: "IT", count: 2 }, { country: " ", count: 1 }, { country: "DE", count: 1 }],
    users: [
      { id: "u1", email: "a@x.it", firstName: "Anna", lastName: "Rossi" },
      { id: "u2", email: "b@x.it", firstName: null, lastName: null },
      { id: "u3", email: "c@x.it", firstName: "Carl" },
      { id: "u4", email: "d@x.it" }
    ],
    modelsByUser: [{ userId: "u1", count: 2 }, { userId: "u3", count: 1 }, { userId: "ghost", count: 9 }],
    modelsByCategory: [{ categoryId: "c1", count: 2 }, { categoryId: "c2", count: 1 }],
    categories: [{ id: "c1", name: "A" }, { id: "c2", name: "B" }, { id: "c3", name: "Empty" }],
    awardsByMedal: [{ medalLabel: "Oro", count: 2 }, { medalLabel: "Argento", count: 1 }],
    mentionsByTitle: [{ title: "Best", count: 2 }, { title: "Other", count: 1 }]
  };

  it("merges raw countries that normalise to the same bucket", () => {
    const r = buildStatsOverview({ ...base, usersByCountryRaw: [{ country: null, count: 2 }, { country: "  ", count: 1 }, { country: "", count: 3 }] });
    expect(r.usersByCountry).toEqual([{ country: "N/D", count: 6 }]);
    expect(r.usersTotal).toBe(6);
  });

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

  it("lists zero-model users with email fallback as name, userId and participant number (seqId)", () => {
    const r = buildStatsOverview({
      ...input,
      users: input.users.map((u) => ({ ...u, seqId: u.id === "u4" ? 14 : null }))
    });
    expect(r.zeroModelUsers).toEqual({
      count: 2,
      list: [
        { userId: "u2", participantNumber: null, name: "b@x.it", email: "b@x.it" },
        { userId: "u4", participantNumber: 14, name: "d@x.it", email: "d@x.it" }
      ]
    });
  });
});

describe("buildStatsOverview honors and commended", () => {
  const view = (code: string, assignment: { exhibitor: string; categoryName: string; displayNumber: number } | null) => ({
    id: `id-${code}`, code, name: `Name ${code}`, sortOrder: 0,
    assignment: assignment && {
      categoryId: "c1", categoryName: assignment.categoryName, displayNumber: assignment.displayNumber, modelId: "m1",
      modelName: "Model", modelCode: "M1", wholeDisplay: false, exhibitor: assignment.exhibitor
    }
  });

  it("honors: total of the catalogue, assigned count and the assigned ones only; commended = medalRank 1", () => {
    const r = buildStatsOverview({
      ...base,
      awardsByMedal: [
        { medalLabel: "Highly Commended", medalRank: 1, count: 2 },
        { medalLabel: "Bronze", medalRank: 2, count: 3 },
        { medalLabel: "Highly Commended", medalRank: 1, count: 1 }
      ],
      honorViews: [
        view("bos", { exhibitor: "Anna Rossi", categoryName: "Classe A", displayNumber: 4 }),
        view("bop", null)
      ]
    });
    expect(r.commendedTotal).toBe(3);
    expect(r.honors).toEqual({
      total: 2,
      assigned: 1,
      list: [{ code: "bos", name: "Name bos", exhibitor: "Anna Rossi", categoryName: "Classe A", displayNumber: 4 }]
    });
  });

  it("no awards and no honors: zero", () => {
    const r = buildStatsOverview(base);
    expect(r.commendedTotal).toBe(0);
    expect(r.honors).toEqual({ total: 0, assigned: 0, list: [] });
  });
});
