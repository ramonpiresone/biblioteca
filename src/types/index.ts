import type { Timestamp } from 'firebase/firestore';

export interface Book {
  key: string; // OpenLibrary internal key e.g. /works/OL...
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[]; // Array of ISBNs
  cover_i?: number; // Cover ID from search API
  olid?: string; // OpenLibrary ID (e.g. OLID:OL...) from key
  cover_url_small?: string;
  cover_url_medium?: string;
  cover_url_large?: string;
  description?: string; // Added for storing more detailed description
  lastAccessedAt?: Timestamp; // For Firestore book collection
}

export interface OpenLibrarySearchDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  author_key?: string[];
  edition_key?: string[];
  olid?: string[];
}

export interface OpenLibrarySearchResponse {
  docs: OpenLibrarySearchDoc[];
  numFound: number;
  q: string;
  start: number;
}

export interface OpenLibraryBookData {
  [isbnKey: string]: OpenLibraryBookDetails;
}

export interface OpenLibraryBookDetails {
  url?: string;
  key?: string;
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
  publish_date?: string;
  subjects?: { name: string; url: string }[];
  notes?: string;
  excerpts?: { text: string; comment?: string }[];
  links?: { title: string; url: string }[];
  cover?: {
    small?: string;
    medium?: string;
    large?: string;
  };
}

export interface FirestoreUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  roles: {
    admin: boolean;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FavoriteRecord {
  bookKey: string;
  favoritedAt: Timestamp;
}

export interface Loan {
  id?: string; // Firestore document ID
  userId: string;
  bookKey: string; // Reference to the book's key in the 'books' collection
  bookTitle: string; // Denormalized for easy display
  loanDate: Timestamp;
  dueDate: Timestamp;
  returnDate?: Timestamp | null;
  status: 'active' | 'returned'; // 'active' or 'returned'
  createdAt: Timestamp;
}
