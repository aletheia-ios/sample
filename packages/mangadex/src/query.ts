import type { FilterSelection, SearchQuery } from "@aletheia-ios/sdk/types";
import { withQuery } from "@aletheia-ios/sdk/utils";
import { API, manifest } from "@/constants";

export type Items = Array<readonly [string, string]>;

export function url(path: string, items: Items = []): string {
  return withQuery(`${API}/${path}`, items);
}

// "field:dir" -> order[field]=dir
export function order(sort: string): Items {
  const parts = sort.split(":");
  if (parts.length !== 2) return [];
  return [[`order[${parts[0]}]`, parts[1] ?? "desc"]];
}

export function resolvedSort(query: SearchQuery): string {
  return query.sort ?? manifest.sort.default;
}

export function parameters(filters: FilterSelection[]): Items {
  const items: Items = [];
  for (const filter of filters) {
    switch (filter.kind) {
      case "multiSelect":
        // only tags support exclusion; other multiSelect filters ignore it
        if (filter.id === "tags") {
          for (const id of filter.included) items.push(["includedTags[]", id]);
          for (const id of filter.excluded) items.push(["excludedTags[]", id]);
        } else {
          for (const id of filter.included) items.push([`${filter.id}[]`, id]);
        }
        break;
      case "number":
        items.push([filter.id, String(filter.value)]);
        break;
      case "select":
        items.push([filter.id, filter.optionID]);
        break;
      case "text":
        items.push([filter.id, filter.value]);
        break;
    }
  }
  return items;
}

const CLEAN = ["safe", "suggestive", "erotica"];

export function ratings(query: SearchQuery, gateOpen: boolean): Items {
  if (query.filters.some((filter) => filter.id === "contentRating")) return [];
  const allowed = gateOpen ? [...CLEAN, "pornographic"] : CLEAN;
  return allowed.map((rating) => ["contentRating[]", rating] as const);
}

// cursor is the page number as a string, or null for page one
export function page(query: SearchQuery): number {
  const parsed = Number.parseInt(query.cursor ?? "1", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}
