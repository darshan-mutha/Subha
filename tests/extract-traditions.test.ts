import { describe, expect, it } from "vitest";
import { EXTRACT_JSON_SCHEMA, EXTRACT_SYSTEM_INSTRUCTION, cleanExtraction, type RawExtraction } from "@/lib/extract";
import { matchFunctionName, sameFunctions, suggestedFunctions } from "@/lib/traditions";
import { NOW } from "./fixtures";

const wedding = (over: Partial<RawExtraction> = {}): RawExtraction => ({
  transcript: "Teen din ki shaadi Jaipur mein, hum Marwari, ladke wale Punjabi",
  eventType: "wedding",
  eventName: "",
  date: "2027-02-14",
  city: "Jaipur",
  guests: 250,
  budget: 2500000,
  style: "",
  notes: "",
  focus: [],
  food: "",
  guestNeeds: [],
  ...over,
});

describe("voice start: traditions, days and functions", () => {
  it("asks Claude for the new fields and never to guess a tradition", () => {
    expect(EXTRACT_JSON_SCHEMA.required).toEqual(
      expect.arrayContaining(["traditions", "traditionOther", "days", "functions", "additions"]),
    );
    expect(EXTRACT_SYSTEM_INSTRUCTION).toContain("Never guess a tradition from a city, a surname");
  });

  it("fills the usual functions for the traditions when none are named", () => {
    const { values } = cleanExtraction(wedding({ traditions: ["marwari", "punjabi"], days: 3 }), NOW);
    expect(values.traditions).toEqual(["marwari", "punjabi"]);
    expect(values.days).toBe(3);
    // The same list the form would tick, so later changes to the traditions still update it.
    expect(sameFunctions(values.functions, suggestedFunctions(["marwari", "punjabi"], "wedding", 3, []))).toBe(true);
    expect(values.functions.map((f) => f.name)).toContain("Mayra");
  });

  it("uses the host's named functions with the usual names and days", () => {
    const { values } = cleanExtraction(
      wedding({
        traditions: ["marwari"],
        days: 2,
        functions: [
          { name: "mehendi", day: 1 },
          { name: "sangeet", day: 0 },
          { name: "pheras", day: 2 },
          { name: "Mehendi", day: 1 }, // said twice
          { name: "dandiya night", day: 0 }, // not in any list: kept in the host's words
        ],
        additions: ["welcome", "choreography"],
      }),
      NOW,
    );
    expect(values.functions).toEqual([
      { name: "Mehendi", day: 1 },
      { name: "Sangeet", day: 1 },
      { name: "Wedding (pheras)", day: 2 },
      { name: "Dandiya night", day: 1 },
      { name: "Welcome dinner", day: 1 },
    ]);
    expect(values.additions).toEqual(["welcome", "choreography"]);
  });

  it("works out the days from the functions when the number is not said", () => {
    const { values } = cleanExtraction(
      wedding({
        functions: [
          { name: "haldi", day: 1 },
          { name: "nikah", day: 3 },
        ],
      }),
      NOW,
    );
    expect(values.days).toBe(3);
    expect(values.functions).toEqual([
      { name: "Haldi", day: 1 },
      { name: "Nikah", day: 3 },
    ]);
  });

  it("keeps another community's name, drops invalid choices and too many days", () => {
    const { values } = cleanExtraction(
      wedding({ traditions: ["other", "klingon"], traditionOther: "Sindhi", days: 12 }),
      NOW,
    );
    expect(values.traditions).toEqual(["other"]); // an unknown value is dropped, the rest kept
    expect(values.traditionOther).toBe("Sindhi");
    expect(values.days).toBe(1);
  });

  it("gives one tradition and no functions for a pooja, and nothing for a birthday", () => {
    const pooja = cleanExtraction(
      wedding({
        eventType: "religious-ceremony",
        traditions: ["tamil", "telugu"],
        days: 2,
        functions: [{ name: "homam", day: 1 }],
      }),
      NOW,
    ).values;
    expect(pooja).toMatchObject({ traditions: ["tamil"], days: 1, functions: [] });
    const birthday = cleanExtraction(wedding({ eventType: "birthday", traditions: ["tamil"] }), NOW).values;
    expect(birthday).toMatchObject({ traditions: [], days: 1, functions: [], additions: [] });
  });

  it("still reads older replies without the new fields", () => {
    const { values } = cleanExtraction(wedding(), NOW);
    expect(values).toMatchObject({ traditions: [], days: 1, functions: [], additions: [] });
  });
});

describe("matchFunctionName", () => {
  it("finds the usual name, trying the family's tradition first", () => {
    expect(matchFunctionName("haldi", ["marwari"])).toBe("Haldi (pithi)");
    expect(matchFunctionName("haldi", [])).toBe("Haldi");
    expect(matchFunctionName("anand karaj", [])).toBe("Anand Karaj");
    expect(matchFunctionName("bachelorette", [])).toBe("Bachelor / bachelorette party");
    expect(matchFunctionName("  ghoomar  evening ", [])).toBe("Ghoomar evening");
  });
});
