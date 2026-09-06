import type { Filter, LanguageCode, SourceManifest } from "@aletheia-ios/sdk/types";
import rawFilters from "../filters.json";
import rawManifest from "../source.json";

export const manifest = rawManifest as SourceManifest;
export const filters = rawFilters as Filter[];

export const API = "https://api.mangadex.org";
export const UPLOADS = "https://uploads.mangadex.org";
export const LANGUAGES: readonly LanguageCode[] = manifest.languages;

export const LIMIT = 30;
export const FEED_LIMIT = 500;
export const FEED_CAP = 20;
export const COVER_PAGE_LIMIT = 100;
export const COVER_LIMIT = 20;
