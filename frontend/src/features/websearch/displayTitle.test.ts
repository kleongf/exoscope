import { describe, expect, it } from "vitest";
import { displayTitle } from "./evidence";

const at = (url: string, title = "www.sciencenews.org") => ({
  url,
  title,
  domain: "www.sciencenews.org",
});

describe("displayTitle", () => {
  it("keeps a real page title", () => {
    expect(displayTitle(at("https://x.org/a", "JWST finds no thick atmosphere"))).toBe(
      "JWST finds no thick atmosphere",
    );
  });
  it("derives a title from the URL slug when the provider gave only the domain", () => {
    expect(
      displayTitle(
        at("https://www.sciencenews.org/article/some-trappist-1-planets-may-be-water-worlds"),
      ),
    ).toBe("Some trappist 1 planets may be water worlds");
  });
  it("treats numeric labels like [1] as missing titles", () => {
    expect(displayTitle(at("https://x.org/news/water_on_mars.html", "1"))).toBe("Water on mars");
  });
  it("falls back to the domain for bare or ID-like paths", () => {
    expect(displayTitle(at("https://www.sciencenews.org/"))).toBe("www.sciencenews.org");
    expect(displayTitle(at("https://x.org/abs/2309.07047"))).toBe("www.sciencenews.org");
    expect(displayTitle(at("https://x.org/p/9f8e7d6c5b4a"))).toBe("www.sciencenews.org");
  });
});
