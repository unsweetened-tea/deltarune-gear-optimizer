import { describe, expect, it } from "vitest"
import { HOME_ROUTE, parseRoute, routeHref } from "./routes"

describe("parseRoute", () => {
  it("treats the root path as Home", () => {
    expect(parseRoute("")).toEqual(HOME_ROUTE)
    expect(parseRoute("#")).toEqual(HOME_ROUTE)
    expect(parseRoute("#/")).toEqual(HOME_ROUTE)
  })

  it("falls back to Home for unknown routes", () => {
    expect(parseRoute("#/nope")).toEqual(HOME_ROUTE)
    expect(parseRoute("#/optimise")).toEqual(HOME_ROUTE)
  })

  it("resolves the existing screens", () => {
    expect(parseRoute("#/optimize").tab).toBe("optimize")
    expect(parseRoute("#/solo").tab).toBe("solo")
    expect(parseRoute("#/import").tab).toBe("import")
    expect(parseRoute("#/items").tab).toBe("items")
    expect(parseRoute("#/characters").tab).toBe("characters")
    expect(parseRoute("#/about").tab).toBe("about")
  })

  it("defaults Optimize to the playstyle sub-tab", () => {
    expect(parseRoute("#/optimize").optimizeCategory).toBe("playstyle")
    expect(parseRoute("#/optimize/bogus").optimizeCategory).toBe("playstyle")
  })

  it("deep-links the Optimize sub-tabs", () => {
    expect(parseRoute("#/optimize/bosses").optimizeCategory).toBe("boss")
    expect(parseRoute("#/optimize/stat").optimizeCategory).toBe("stat")
  })
})

describe("routeHref", () => {
  it("round-trips through parseRoute", () => {
    expect(parseRoute(routeHref("home"))).toEqual(HOME_ROUTE)
    expect(parseRoute(routeHref("items")).tab).toBe("items")
    expect(parseRoute(routeHref("optimize", "boss"))).toEqual({
      tab: "optimize",
      optimizeCategory: "boss",
    })
  })

  it("leaves the default sub-tab out of the hash", () => {
    expect(routeHref("optimize")).toBe("#/optimize")
    expect(routeHref("optimize", "playstyle")).toBe("#/optimize")
  })
})
