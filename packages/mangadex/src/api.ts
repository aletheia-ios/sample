// the shapes mangadex answers with - only the fields the source reads

export interface MangaList {
  data: Manga[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaEnvelope {
  data: Manga;
}

export interface Manga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles: Record<string, string>[];
    description?: Record<string, string>;
    status?: string;
    contentRating?: string;
    originalLanguage?: string;
    tags: Tag[];
  };
  relationships: Relationship[];
}

export interface Tag {
  attributes: { name?: Record<string, string> };
}

export interface Relationship {
  type: string;
  attributes?: { name?: string; fileName?: string };
}

export interface ChapterList {
  data: Chapter[];
  total: number;
}

export interface Chapter {
  id: string;
  attributes: {
    title?: string;
    chapter?: string;
    translatedLanguage?: string;
    externalUrl?: string;
    publishAt?: string;
  };
  relationships: Relationship[];
}

export interface CoverList {
  data: CoverArt[];
}

export interface CoverArt {
  attributes: { fileName: string; volume?: string; locale?: string };
}

export interface AtHome {
  baseUrl: string;
  chapter: { hash: string; data: string[] };
}
