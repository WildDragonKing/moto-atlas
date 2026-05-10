import { describe, it, expect } from "vitest";
import { applyFilters, transformRoute } from "../src/lib/data.svelte.js";

describe("transformRoute", () => {
  it("uses geometry coords when present", () => {
    const r = transformRoute({
      id: "x",
      name: "X",
      country: "de",
      type: "offroad",
      geometry: {
        type: "LineString",
        coordinates: [
          [7, 50],
          [7.1, 50.1],
          [7.2, 50.2],
        ],
      },
    });
    expect(r.path).toHaveLength(3);
    expect(r.path[0]).toEqual([7, 50]);
  });

  it("falls back to bounds when geometry missing", () => {
    const r = transformRoute({
      id: "x",
      name: "X",
      country: "de",
      bounds: { west: 6, east: 8, south: 50, north: 51 },
    });
    expect(r.path).toHaveLength(3);
  });

  it("computes duration from distance + type", () => {
    expect(
      transformRoute({ id: "a", name: "A", country: "de", type: "touring", distance_km: 90 })
        .duration_h,
    ).toBe(2);
    expect(
      transformRoute({ id: "b", name: "B", country: "de", type: "offroad", distance_km: 56 })
        .duration_h,
    ).toBe(2);
  });

  it("passes through source_gpx_url and gpx_redistribution", () => {
    const r = transformRoute({
      id: "x",
      name: "X",
      country: "de",
      source_url: "https://example.com",
      source_gpx_url: "https://example.com/r.gpx",
      gpx_redistribution: "allowed",
    });
    expect(r.source_gpx_url).toBe("https://example.com/r.gpx");
    expect(r.gpx_redistribution).toBe("allowed");
  });

  it("defaults gpx_redistribution to link_only when missing", () => {
    const r = transformRoute({ id: "x", name: "X", country: "de" });
    expect(r.gpx_redistribution).toBe("link_only");
  });
});

describe("applyFilters", () => {
  const routes = [
    { country: "de", type: "offroad", difficulty: 3 },
    { country: "de", type: "touring", difficulty: 2 },
    { country: "fr", type: "offroad", difficulty: 4 },
  ];

  it("passes all routes with all-filters", () => {
    expect(applyFilters(routes, { country: "all", type: "all", difficulty: "all" })).toHaveLength(
      3,
    );
  });

  it("filters by country", () => {
    expect(applyFilters(routes, { country: "de", type: "all", difficulty: "all" })).toHaveLength(2);
  });

  it("filters by type", () => {
    expect(
      applyFilters(routes, { country: "all", type: "offroad", difficulty: "all" }),
    ).toHaveLength(2);
  });

  it("filters by difficulty (numeric coerce)", () => {
    expect(applyFilters(routes, { country: "all", type: "all", difficulty: 3 })).toHaveLength(1);
    expect(applyFilters(routes, { country: "all", type: "all", difficulty: "3" })).toHaveLength(1);
  });

  it("combines filters", () => {
    expect(
      applyFilters(routes, { country: "de", type: "offroad", difficulty: "all" }),
    ).toHaveLength(1);
  });
});
