import { describe, it, expect } from "vitest";
import { buildCeremony, orderHonors } from "../podium";
import { countryName, countryOptions } from "../countries";

const honor = (code: string, sortOrder = 1) => ({ code, name: code.toUpperCase(), sortOrder });

const data = {
  classes: [
    {
      categoryId: "c1",
      name: "Armor",
      prizes: [
        { medalLabel: "Bronze", medalRank: 2, modelName: "Bronze Tank" },
        { medalLabel: "Gold", medalRank: 4, modelName: "Gold Tank" }
      ]
    },
    { categoryId: "c2", name: "Empty", prizes: [] },
    { categoryId: "c3", name: "Figures", prizes: [{ medalLabel: "Silver", medalRank: 3, wholeDisplay: true }] }
  ],
  honors: [honor("bos"), honor("trophy-a", 2)]
};

describe("ceremony screens", () => {
  it("shows each class title before its prizes, in the given order, and skips classes without prizes", () => {
    const { classes, screens } = buildCeremony(data);
    expect(classes.map((c) => c.name)).toEqual(["Armor", "Figures"]);
    expect(screens.slice(0, 3)).toEqual([
      { kind: "class", classIndex: 0, revealed: 0 },
      { kind: "class", classIndex: 0, revealed: 1 },
      { kind: "class", classIndex: 0, revealed: 2 }
    ]);
    expect(screens.slice(3, 5)).toEqual([
      { kind: "class", classIndex: 1, revealed: 0 },
      { kind: "class", classIndex: 1, revealed: 1 }
    ]);
  });

  it("presents the special awards after all classes, Best of Show last", () => {
    const { screens } = buildCeremony(data);
    const honors = screens.slice(5);
    expect(honors).toEqual([
      { kind: "honor", honor: honor("trophy-a", 2) },
      { kind: "honor", honor: honor("bos") }
    ]);
  });

  it("keeps the given order of honors and moves only bos to the end", () => {
    const list = [honor("bos"), honor("x"), honor("y")];
    expect(orderHonors(list).map((h) => h.code)).toEqual(["x", "y", "bos"]);
  });

  it("returns no screens for an empty ceremony", () => {
    expect(buildCeremony({ classes: [], honors: [] }).screens).toEqual([]);
  });
});

describe("countries", () => {
  it("provides localized, sorted options", () => {
    expect(countryName("IT", "en")).toBe("Italy");
    expect(countryName("IT", "it")).toBe("Italia");
    const opts = countryOptions("en");
    expect(opts.find((o) => o.code === "DE")?.name).toBe("Germany");
    expect(opts.map((o) => o.name)).toEqual([...opts.map((o) => o.name)].sort((a, b) => a.localeCompare(b, "en")));
  });
});
