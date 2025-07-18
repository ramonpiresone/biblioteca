
import type { Timestamp } from 'firebase/firestore';

export interface Book {
  key: string; // Firestore document ID, typically the OpenLibrary ID (OLID, e.g., OLXXXXM or OLXXXXW).
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[]; // Array of ISBNs
  cover_i?: number; // Cover ID from search API, primarily for books without ISBNs
  olid?: string; // The specific OpenLibrary Edition ID (e.g., OLXXXXM) if available, otherwise could be work ID.
  cover_url_small?: string;
  cover_url_medium?: string;
  cover_url_large?: string;
  description?: string;
  lastAccessedAt?: Timestamp; // For Firestore book collection - Stays Timestamp as it's direct Firestore interaction
  quantity?: number; // Total quantity of this book in the library
  availableQuantity?: number; // Quantity currently available for loan
}

export interface OpenLibrarySearchDoc {
  key: string; // Work key, e.g., /works/OL...W
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  author_key?: string[];
  edition_key?: string[]; // Array of OLIDs for editions
  olid?: string[]; // Array of OLIDs for editions (sometimes used interchangeably with edition_key)
}

export interface OpenLibrarySearchResponse {
  docs: OpenLibrarySearchDoc[];
  numFound: number;
  q: string;
  start: number;
}

// Represents the structure returned by:
// https://openlibrary.org/api/books?bibkeys=ISBN:...&format=json&jscmd=data
export interface OpenLibraryBookData {
  [isbnKey: string]: OpenLibraryBookDetails; // e.g., "ISBN:1234567890": { ...details... }
}

export interface OpenLibraryBookDetails {
  url?: string; // URL to the book on OpenLibrary
  key?: string; // Key for this specific edition, e.g., /books/OL...M
  title: string;
  subtitle?: string;
  authors?: { url?: string; name: string }[];
  number_of_pages?: number;
  identifiers?: {
    isbn_10?: string[];
    isbn_13?: string[];
    openlibrary?: string[]; // Array of OLIDs for this edition
    // ... other identifiers like goodreads, librarything
  };
  publishers?: { name: string }[];
  publish_date?: string; // Can be a year "1990" or full date "July 26, 2006"
  subjects?: { name: string; url: string }[];
  notes?: string | {type: string, value: string}; // Can be string or object
  excerpts?: { text: string; comment?: string }[];
  links?: { title: string; url: string }[];
  cover?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  // ... other fields like classifications, local_id, etc.
}

export interface FirestoreUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  roles: {
    admin: boolean;
  };
  createdAt: Timestamp; // Stays Timestamp for Firestore direct interaction
  updatedAt: Timestamp; // Stays Timestamp for Firestore direct interaction
}

export interface FavoriteRecord {
  bookKey: string; // Firestore document ID of the book (OLID)
  favoritedAt: Timestamp; // Stays Timestamp
}

export interface Loan {
  id?: string; // Firestore document ID
  adminId: string; // UID of the admin who created the loan
  adminName?: string; // Name of the admin who created the loan
  adminEmail?: string; // Email of the admin who created the loan
  studentName: string; // Name of the student borrowing the book
  studentCPF: string; // CPF of the student borrowing the book
  bookKey: string; // Firestore document ID of the book (OLID)
  bookTitle: string; // Denormalized for easy display
  loanDate: Date; // Date when the loan was created
  dueDate: Date; // Expected return date
  returnDate?: Date | null; // Actual return date
  status: 'active' | 'returned';
  createdAt: Date; // Creation timestamp
}
