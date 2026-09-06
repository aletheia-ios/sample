import type {
  ChapterEntry,
  Classification,
  LanguageCode,
  Publication,
  SeriesStub,
} from "@aletheia-ios/sdk/types";
import { parseISO } from "@aletheia-ios/sdk/utils";
import type { Chapter, CoverArt, Manga } from "@/api";
import { COVER_LIMIT, LANGUAGES, UPLOADS } from "@/constants";

// mangadex files romanisations under a "-ro" locale suffix (e.g. "ja-ro")
const TITLE_PRIORITY = ["en", "ja-ro", "ko-ro", "zh-ro", "ja", "ko", "zh"];

export function text(map: Record<string, string> | undefined): string | null {
  if (!map) return null;
  const keys = Object.keys(map);
  if (keys.length === 0) return null;
  if (map.en !== undefined) return map.en;
  const first = keys.sort()[0];
  return first === undefined ? null : (map[first] ?? null);
}

// pooled rather than checked map by map - `title` holds the original language and the
// romanisation is in altTitles, so walking maps in priority order would return the
// japanese before ever reaching the romaji
export function title(
  primary: Record<string, string>,
  alternates: Record<string, string>[],
): string {
  const pool = new Map<string, string>();
  for (const map of [primary, ...alternates]) {
    for (const [locale, name] of Object.entries(map)) {
      if (!pool.has(locale) && name !== "") pool.set(locale, name);
    }
  }
  for (const locale of TITLE_PRIORITY) {
    const name = pool.get(locale);
    if (name !== undefined) return name;
  }
  const keys = Array.from(pool.keys()).sort();
  const romanised = keys.find((key) => key.endsWith("-ro"));
  if (romanised !== undefined) return pool.get(romanised) ?? "Untitled";
  const first = keys[0];
  return first === undefined ? "Untitled" : (pool.get(first) ?? "Untitled");
}

function coverURL(manga: string, file: string): string {
  return `${UPLOADS}/covers/${manga}/${file}`;
}

export function cover(entry: Manga): string | null {
  const file = entry.relationships.find((r) => r.type === "cover_art")?.attributes?.fileName;
  return file === undefined ? null : coverURL(entry.id, file);
}

// one cover per volume (by whole number - alternate editions are filed as 1.1, 1.2
// against the same volume), since every kept cover is an image the downloader fetches
export function covers(listing: CoverArt[], entry: Manga, language: string | undefined): string[] {
  const native = listing.filter((art) => art.attributes.locale === language);
  const pool = native.length === 0 ? listing : native;
  const volumes = new Set<string>();
  const urls: string[] = [];
  for (const art of pool) {
    const volume = (art.attributes.volume ?? "").split(".")[0] ?? "";
    if (volumes.has(volume)) continue;
    volumes.add(volume);
    urls.push(coverURL(entry.id, art.attributes.fileName));
  }
  const primary = cover(entry);
  if (primary !== null) {
    const rest = urls.filter((url) => url !== primary);
    rest.unshift(primary);
    return rest.slice(0, COVER_LIMIT);
  }
  return urls.slice(0, COVER_LIMIT);
}

export function stub(entry: Manga): SeriesStub {
  return {
    slug: entry.id,
    title: title(entry.attributes.title, entry.attributes.altTitles),
    cover: cover(entry),
    adult: entry.attributes.contentRating === "pornographic",
  };
}

export function classification(rating: string | undefined): Classification {
  switch (rating) {
    case "safe":
      return "Safe";
    case "suggestive":
      return "Suggestive";
    case "erotica":
    case "pornographic":
      return "Explicit";
    default:
      return "Unknown";
  }
}

export function publication(status: string | undefined): Publication {
  switch (status) {
    case "ongoing":
      return "Ongoing";
    case "completed":
      return "Completed";
    case "hiatus":
      return "Hiatus";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function isLanguage(value: string): value is LanguageCode {
  return (LANGUAGES as readonly string[]).includes(value);
}

export function entry(chapter: Chapter): ChapterEntry | null {
  const attributes = chapter.attributes;
  if (attributes.externalUrl) return null;
  // drop rather than default - mislabeling an unmapped language as english displays
  // it wrong instead of just omitting it
  const language = attributes.translatedLanguage;
  if (language === undefined || !isLanguage(language)) return null;
  const scanlator = chapter.relationships.find((r) => r.type === "scanlation_group")?.attributes
    ?.name;
  const number = Number.parseFloat(attributes.chapter ?? "");
  return {
    slug: chapter.id,
    title: attributes.title ?? "",
    number: Number.isFinite(number) ? number : 0,
    language,
    scanlator: scanlator ?? "Unknown",
    url: `https://mangadex.org/chapter/${chapter.id}`,
    publishedDate: attributes.publishAt === undefined ? null : parseISO(attributes.publishAt),
  };
}
