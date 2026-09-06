import { fetchJSON } from "@aletheia-ios/sdk/host";
import type {
  ChapterEntry,
  ChapterRevalidation,
  Revalidating,
  SearchPage,
  SeriesStub,
  Source,
} from "@aletheia-ios/sdk/types";
import { allowsAdult } from "@aletheia-ios/sdk/utils";
import type { AtHome, ChapterList, CoverArt, CoverList, MangaEnvelope, MangaList } from "@/api";
import {
  COVER_PAGE_LIMIT,
  FEED_CAP,
  FEED_LIMIT,
  filters,
  LANGUAGES,
  LIMIT,
  manifest,
} from "@/constants";
import { classification, covers, entry, publication, stub, text, title } from "@/mapping";
import { type Items, order, page, parameters, ratings, resolvedSort, url } from "@/query";

const source: Source & Revalidating = {
  async search(query): Promise<SearchPage<SeriesStub>> {
    const current = page(query);
    const offset = (current - 1) * LIMIT;
    const items: Items = [
      ["limit", String(LIMIT)],
      ["offset", String(offset)],
      ["includes[]", "cover_art"],
      ["hasAvailableChapters", "true"],
    ];
    if (query.text) items.push(["title", query.text]);
    items.push(...parameters(query.filters));
    items.push(...ratings(query, allowsAdult(query, manifest.contentRating, filters)));
    // the api rejects sorting by relevance when there is no search text
    const sort = resolvedSort(query);
    const usable = sort === "relevance:desc" && !query.text ? "followedCount:desc" : sort;
    items.push(...order(usable));

    const response = await fetchJSON<MangaList>({ url: url("manga", items) });
    const seen = response.offset + response.data.length;
    return {
      items: response.data.map(stub),
      next: seen < response.total ? String(current + 1) : null,
    };
  },

  async details(seriesSlug) {
    // the manga entity only ever returns one cover_art relationship regardless of
    // includes - the full set needs its own request
    const listing = coverListing(seriesSlug);
    const response = await fetchJSON<MangaEnvelope>({
      url: url(`manga/${seriesSlug}`, [
        ["includes[]", "cover_art"],
        ["includes[]", "author"],
        ["includes[]", "artist"],
      ]),
    });
    const manga = response.data;
    const attributes = manga.attributes;
    const names = attributes.altTitles.flatMap((map) => Object.values(map));
    return {
      slug: manga.id,
      title: title(attributes.title, attributes.altTitles),
      altTitles: Array.from(new Set(names)).sort(),
      synopsis: text(attributes.description) ?? "",
      url: `${manifest.baseURL}/title/${manga.id}`,
      classification: classification(attributes.contentRating),
      publication: publication(attributes.status),
      covers: covers(await listing, manga, attributes.originalLanguage),
      tags: attributes.tags.flatMap((tag) => {
        const name = text(tag.attributes.name);
        return name === null ? [] : [name];
      }),
      authors: manga.relationships
        .filter((r) => r.type === "author" || r.type === "artist")
        .flatMap((r) => (r.attributes?.name === undefined ? [] : [r.attributes.name])),
    };
  },

  async chapters(seriesSlug) {
    const result = await walk(seriesSlug, null);
    return result.kind === "changed" ? result.entries : [];
  },

  // the feed's own stated total is trustworthy, so a matching count on the first page
  // answers the whole question without walking the rest
  chaptersChanged(seriesSlug, stored) {
    return walk(seriesSlug, stored);
  },

  async content(_seriesSlug, chapterSlug) {
    const response = await fetchJSON<AtHome>({ url: url(`at-home/server/${chapterSlug}`) });
    const directory = `${response.baseUrl}/data/${response.chapter.hash}`;
    return response.chapter.data.map((name, index) => ({
      index,
      url: `${directory}/${name}`,
    }));
  },
};

// swallow failures here - the entity's own cover is still a usable fallback
async function coverListing(id: string): Promise<CoverArt[]> {
  try {
    const response = await fetchJSON<CoverList>({
      url: url("cover", [
        ["manga[]", id],
        ["limit", String(COVER_PAGE_LIMIT)],
        ["order[volume]", "asc"],
      ]),
    });
    return response.data;
  } catch {
    return [];
  }
}

async function walk(seriesSlug: string, stored: number | null): Promise<ChapterRevalidation> {
  const entries: ChapterEntry[] = [];
  let offset = 0;
  for (let pass = 0; pass < FEED_CAP; pass += 1) {
    const items: Items = [
      ["limit", String(FEED_LIMIT)],
      ["offset", String(offset)],
      ["includes[]", "scanlation_group"],
      ["order[chapter]", "asc"],
      ...LANGUAGES.map((language) => ["translatedLanguage[]", language] as const),
      ...["safe", "suggestive", "erotica", "pornographic"].map(
        (rating) => ["contentRating[]", rating] as const,
      ),
    ];
    const response = await fetchJSON<ChapterList>({
      url: url(`manga/${seriesSlug}/feed`, items),
    });
    if (offset === 0 && stored !== null && response.total === stored) return { kind: "unchanged" };
    for (const chapter of response.data) {
      const mapped = entry(chapter);
      if (mapped !== null) entries.push(mapped);
    }
    offset += response.data.length;
    if (response.data.length === 0 || offset >= response.total) break;
  }
  return { kind: "changed", entries };
}

export default source;
