import { describe, expect, it } from "vitest";
import { extractId } from "./util";

describe("extractId", () => {
  const id = "dc28a62b-88c2-40d6-869e-445ee3251558";

  it("accepts a plain id, in any case and with spaces", () => {
    expect(extractId(`  ${id.toUpperCase()} `)).toBe(id);
  });

  it("finds the id in a kulturpool.at link", () => {
    expect(extractId(`https://kulturpool.at/objekte/${id}`)).toBe(id);
  });

  it("returns undefined for normal search text", () => {
    expect(extractId("Klimt Katze")).toBeUndefined();
  });
});
