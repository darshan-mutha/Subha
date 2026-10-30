import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("quotes cells with commas, quotes or new lines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(4)).toBe("4");
    expect(csvCell('Say "hi", please')).toBe('"Say ""hi"", please"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("stops a cell being read as a formula", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+91 98290")).toBe("'+91 98290");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@x")).toBe("'@x");
  });

  it("joins rows into lines", () => {
    expect(
      toCsv([
        ["Name", "People"],
        ["Meena, aunty", 2],
      ]),
    ).toBe('Name,People\n"Meena, aunty",2');
  });
});
