
export interface Book {
  key: string; // OpenLibrary internal key e.g. /works/OL...
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[]; // Array of ISBNs
  cover_i?: number; // Cover ID from search API
  // Derived properties
  olid?: string; // OpenLibrary ID (e.g. OLID:OL...) from key
  cover_url_small?: string;
  cover_url_medium?: string;
  cover_url_large?: string;
  // For AI features
  description?: string; // From detailed fetch or excerpts
}

// Simplified structure from OpenLibrary Search API
export interface OpenLibrarySearchDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  author_key?: string[];
  edition_key?: string[];
  olid?: string[]; // Often OpenLibrary IDs for editions
}

export interface OpenLibrarySearchResponse {
  docs: OpenLibrarySearchDoc[];
  numFound: number;
  q: string;
  start: number;
}

// For the detailed book data from OpenLibrary Books API (using ISBN)
// e.g. https://openlibrary.org/api/books?bibkeys=ISBN:0451526538&format=json&jscmd=data
// The key in the response is like "ISBN:0451526538"
export interface OpenLibraryBookData {
  [isbnKey: string]: OpenLibraryBookDetails;
}

export interface OpenLibraryBookDetails {
  publishers?: { name: string }[];
  subtitle?: string;
  title: string;
  url?: string;
  number_of_pages?: number;
  cover?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  publish_date?: string; // e.g. "June 1, 2000"
  authors?: { url?: string; name: string }[];
  excerpts?: { text: string, comment: string }[];
  // There are many other fields like classifications, links, etc.
}

export interface AiAnalysis {
  synopsis: string;
  genres: string; // Comma-separated from generateBookSynopsis
}
