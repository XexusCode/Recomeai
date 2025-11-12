import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET } from "@/app/api/recommendations/route";

const buildRecommendationsMock = vi.fn();

vi.mock("@/server/recommendations/pipeline", () => ({
  buildRecommendations: buildRecommendationsMock,
}));

describe("GET /api/recommendations", () => {
  beforeEach(() => {
    buildRecommendationsMock.mockResolvedValue({
      anchor: {
        id: "anchor-1",
        title: "Spirited Away",
        type: "movie",
        year: 2001,
        genres: ["Animation"],
        synopsis: "",
        posterUrl: null,
        popularity: 90,
        providerUrl: null,
        availability: [],
        score: 1,
      },
      items: [
        {
          id: "rec-1",
          title: "Howl's Moving Castle",
          type: "movie",
          year: 2004,
          genres: ["Fantasy"],
          synopsis: "",
          posterUrl: null,
          popularity: 85,
          providerUrl: null,
          availability: [],
          reason: "Si disfrutaste Spirited Away, esta propuesta animada combina fantasía y aventura, mantiene un tono cinematográfico, y aporta narrativa sorprendente cautivador.",
          score: 0.9,
        },
      ],
      debug: { relaxations: 0, totalCandidates: 12 },
    });
  });

  it("returns recommendations payload", async () => {
    const request = new Request("http://localhost/api/recommendations?query=Spirited%20Away&type=movie");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.items).toHaveLength(1);
    expect(json.anchor.title).toBe("Spirited Away");
    expect(buildRecommendationsMock).toHaveBeenCalledWith({
      query: "Spirited Away",
      type: "movie",
      yearMin: undefined,
      yearMax: undefined,
      popMin: undefined,
      limit: undefined,
    });
  });

  it("validates query params", async () => {
    const request = new Request("http://localhost/api/recommendations");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});

