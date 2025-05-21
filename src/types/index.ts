
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
  url?: string; // e.g., "https://openlibrary.org/books/OL30678200M/Pai_Rico_Pai_Pobre"
  key?: string; // e.g., "/books/OL30678200M"
  title: string;
  subtitle?: string;
  authors?: { url?: string; name: string }[];
  number_of_pages?: number;
  identifiers?: {
    isbn_10?: string[];
    isbn_13?: string[];
    openlibrary?: string[];
  };
  publishers?: { name: string }[];
  publish_date?: string; // e.g. "Oct 20, 2017"
  subjects?: { name: string; url: string }[];
  notes?: string; // Can be general notes or source information
  links?: { title: string; url: string }[];
  cover?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  // Removed 'excerpts' as it's not in the provided example structure.
}

// Type for AI Analysis (currently unused as AI features were removed)
export interface AiAnalysis {
  synopsis: string;
  genres: string; // Comma-separated list
}
