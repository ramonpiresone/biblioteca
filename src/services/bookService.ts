
import { db } from '@/lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  where,
  documentId,
  runTransaction,
  limit,
  startAt,
  endAt,
  QueryConstraint,
} from 'firebase/firestore';
import type { Book, FavoriteRecord, OpenLibraryBookDetails } from '@/types';
import { getBookDetailsByISBN as fetchBookDetailsFromAPI } from '@/lib/open-library';

/**
 * Ensures a book exists in the top-level 'books' collection, typically called when a user interacts (e.g., favorites)
 * If it doesn't exist, it's added. Updates `lastAccessedAt` timestamp.
 * This function DOES NOT set or modify quantity fields.
 * @param book The book object from OpenLibrary search or similar source. Its `key` should be the OLID.
 */
export async function ensureBookExists(book: Book): Promise<void> {
  if (!book || !book.key) {
    console.error('ensureBookExists called with invalid book data');
    return;
  }
  const bookRef = doc(db, 'books', book.key);
  
  try {
    await runTransaction(db, async (transaction) => {
      const bookSnap = await transaction.get(bookRef);
      
      const dataForFirestore: Partial<Book> = {
        key: book.key, // This is the doc ID, also stored as a field
        title: book.title, // Assumed to be always present from Book type
        author_name: book.author_name || [], // Default to empty array
        isbn: book.isbn || [], // Default to empty array
        lastAccessedAt: serverTimestamp() as Timestamp,
      };

      // Add optional fields only if they are defined
      if (book.first_publish_year !== undefined) dataForFirestore.first_publish_year = book.first_publish_year;
      if (book.cover_i !== undefined) dataForFirestore.cover_i = book.cover_i; // Critical fix for the error
      if (book.olid !== undefined) dataForFirestore.olid = book.olid;
      if (book.cover_url_small !== undefined) dataForFirestore.cover_url_small = book.cover_url_small;
      if (book.cover_url_medium !== undefined) dataForFirestore.cover_url_medium = book.cover_url_medium;
      if (book.cover_url_large !== undefined) dataForFirestore.cover_url_large = book.cover_url_large;
      if (book.description !== undefined) dataForFirestore.description = book.description;
      // ensureBookExists does not handle quantity fields
      // if (book.quantity !== undefined) dataForFirestore.quantity = book.quantity;
      // if (book.availableQuantity !== undefined) dataForFirestore.availableQuantity = book.availableQuantity;


      if (!bookSnap.exists()) {
        // New document: set it.
        // Firestore requires that all properties are defined, no 'undefined' values.
        transaction.set(bookRef, dataForFirestore);
      } else {
        // Existing document: merge it.
        // Only the fields present in dataForFirestore will be updated.
        transaction.set(bookRef, dataForFirestore, { merge: true });
      }
    });
  } catch (error) {
    console.error("Transaction failed for ensureBookExists: ", error);
    throw error; // Re-throw so upstream can potentially handle it
  }
}

/**
 * Admin function to add a new book by ISBN with a specified quantity or update an existing one.
 * Fetches details from OpenLibrary and stores/updates in Firestore.
 * @param isbn The ISBN of the book.
 * @param quantity The total quantity of the book.
 * @returns The created or updated Book object from Firestore, or null on failure.
 */
export async function adminAddBook(isbn: string, quantity: number): Promise<Book | null> {
  if (!isbn || quantity < 0) {
    console.error('adminAddBook called with invalid parameters');
    return null;
  }

  try {
    const bookDetailsAPI: OpenLibraryBookDetails | null = await fetchBookDetailsFromAPI(isbn);
    if (!bookDetailsAPI || !bookDetailsAPI.key) {
      console.error(`No details found for ISBN: ${isbn} or missing key (bookDetailsAPI.key).`);
      return null;
    }
    
    const firestoreBookKey = bookDetailsAPI.key.split('/').pop();
    if (!firestoreBookKey) {
        console.error(`Could not extract OLID from bookDetailsAPI.key: ${bookDetailsAPI.key}`);
        return null;
    }

    const bookRef = doc(db, 'books', firestoreBookKey);

    const authors = bookDetailsAPI.authors?.map(a => a.name) || [];
    let publishYear: number | undefined = undefined;
    if (bookDetailsAPI.publish_date) {
        const yearMatch = bookDetailsAPI.publish_date.match(/\d{4}/);
        if (yearMatch) {
            publishYear = parseInt(yearMatch[0], 10);
        }
    }

    const olidValue = firestoreBookKey.startsWith('OL') ? firestoreBookKey : bookDetailsAPI.identifiers?.openlibrary?.[0];
    const descriptionValue = bookDetailsAPI.subtitle || (typeof bookDetailsAPI.notes === 'string' ? bookDetailsAPI.notes : bookDetailsAPI.notes?.value);

    const dataToSave: Partial<Book> = {
      key: firestoreBookKey,
      title: bookDetailsAPI.title, // Assuming title is always present
      author_name: authors.length > 0 ? authors : [], // Default to empty array
      isbn: bookDetailsAPI.identifiers?.isbn_13 || bookDetailsAPI.identifiers?.isbn_10 || [isbn], // Should yield an array
      quantity: quantity,
      availableQuantity: quantity, 
      lastAccessedAt: serverTimestamp() as Timestamp,
    };
    
    // Add optional fields only if they are defined
    if (publishYear !== undefined) dataToSave.first_publish_year = publishYear;
    if (bookDetailsAPI.cover?.small !== undefined) dataToSave.cover_url_small = bookDetailsAPI.cover.small;
    if (bookDetailsAPI.cover?.medium !== undefined) dataToSave.cover_url_medium = bookDetailsAPI.cover.medium;
    if (bookDetailsAPI.cover?.large !== undefined) dataToSave.cover_url_large = bookDetailsAPI.cover.large;
    if (olidValue !== undefined) dataToSave.olid = olidValue;
    if (descriptionValue !== undefined) dataToSave.description = descriptionValue;
    // cover_i is not typically available from the ISBN details endpoint (fetchBookDetailsFromAPI),
    // so we don't attempt to set it here. It would come from search results if ensureBookExists handles it.

    await setDoc(bookRef, dataToSave, { merge: true }); 
    // merge: true will create if it doesn't exist, and only update specified (defined) fields if it does.
    
    console.log(`Book ${firestoreBookKey} added/updated by admin with quantity ${quantity}.`);
    
    const savedBookSnap = await getDoc(bookRef);
    if (savedBookSnap.exists()) {
        return { ...savedBookSnap.data(), key: savedBookSnap.id } as Book;
    }
    return null;

  } catch (error) {
    console.error(`Failed to add/update book for ISBN ${isbn}:`, error);
    return null;
  }
}


/**
 * Adds a book to the user's favorites subcollection and ensures the book exists in the main 'books' collection.
 * @param userId The ID of the user.
 * @param book The book to add to favorites. Its `key` should be the OLID.
 */
export async function addFavorite(userId: string, book: Book): Promise<void> {
  if (!userId || !book || !book.key) {
    console.error('addFavorite called with invalid parameters');
    return;
  }
  await ensureBookExists(book); 
  const favoriteRef = doc(db, 'users', userId, 'favorites', book.key); 
  const favoriteData: FavoriteRecord = {
    bookKey: book.key, 
    favoritedAt: serverTimestamp() as Timestamp,
  };
  await setDoc(favoriteRef, favoriteData);
}

/**
 * Removes a book from the user's favorites subcollection.
 * @param userId The ID of the user.
 * @param bookKey The OLID of the book to remove from favorites.
 */
export async function removeFavorite(userId: string, bookKey: string): Promise<void> {
  if (!userId || !bookKey) {
    console.error('removeFavorite called with invalid parameters');
    return;
  }
  const favoriteRef = doc(db, 'users', userId, 'favorites', bookKey);
  await deleteDoc(favoriteRef);
}

/**
 * Checks if a book is in the user's favorites.
 * @param userId The ID of the user.
 * @param bookKey The OLID of the book to check.
 * @returns True if the book is a favorite, false otherwise.
 */
export async function isFavorite(userId: string, bookKey: string): Promise<boolean> {
  if (!userId || !bookKey) return false;
  const favoriteRef = doc(db, 'users', userId, 'favorites', bookKey);
  const favoriteSnap = await getDoc(favoriteRef);
  return favoriteSnap.exists();
}

/**
 * Fetches all favorite books for a given user.
 * Retrieves favorite records and then fetches corresponding book details.
 * @param userId The ID of the user.
 * @returns A promise that resolves to an array of Book objects.
 */
export async function getFavoriteBooks(userId: string): Promise<Book[]> {
  if (!userId) return [];

  const favoritesColRef = collection(db, 'users', userId, 'favorites');
  const q = query(favoritesColRef, orderBy('favoritedAt', 'desc'));
  const favoritesSnapshot = await getDocs(q);

  const favoriteBookKeys = favoritesSnapshot.docs
    .map((docSnap) => (docSnap.data() as FavoriteRecord).bookKey) 
    .filter(key => !!key); 

  if (favoriteBookKeys.length === 0) {
    return [];
  }

  const books: Book[] = [];
  const CHUNK_SIZE = 30; 
  for (let i = 0; i < favoriteBookKeys.length; i += CHUNK_SIZE) {
      const chunk = favoriteBookKeys.slice(i, i + CHUNK_SIZE);
      if (chunk.length > 0) {
        const booksQuery = query(collection(db, 'books'), where(documentId(), 'in', chunk));
        const booksSnapshot = await getDocs(booksQuery);
        booksSnapshot.forEach((bookDoc) => {
        if (bookDoc.exists()) {
            books.push({ ...bookDoc.data(), key: bookDoc.id } as Book);
        }
        });
      }
  }
  
  const sortedBooks = books.sort((a, b) => {
    const aIndex = favoriteBookKeys.indexOf(a.key); 
    const bIndex = favoriteBookKeys.indexOf(b.key); 
    return aIndex - bIndex;
  });

  return sortedBooks;
}

/**
 * Fetches all books from the library inventory, ordered by title.
 * @returns A promise that resolves to an array of Book objects.
 */
export async function getAllLibraryBooks(): Promise<Book[]> {
  const booksRef = collection(db, 'books');
  // Consider ordering by a more relevant field for initial display, e.g., lastAccessedAt or title
  const q = query(booksRef, orderBy('title', 'asc')); 
  try {
    const querySnapshot = await getDocs(q);
    const books: Book[] = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        books.push({ ...docSnap.data(), key: docSnap.id } as Book);
      }
    });
    return books;
  } catch (error) {
    console.error("Error fetching all library books:", error);
    return [];
  }
}


/**
 * Searches books in the local library inventory.
 * Matches against title (case-insensitive prefix) and ISBNs.
 * @param searchText The text to search for.
 * @param searchLimit Max number of books to return.
 * @param filterByAvailability If true (default), only returns books with availableQuantity > 0.
 * @returns A promise that resolves to an array of Book objects.
 */
export async function searchLibraryBooks(
  searchText: string, 
  searchLimit: number = 10, 
  filterByAvailability: boolean = true
): Promise<Book[]> {
  if (!searchText.trim()) {
    return [];
  }

  const booksRef = collection(db, 'books');
  const searchTextLower = searchText.toLowerCase();
  
  const queryConstraints: QueryConstraint[] = [];

  // Base query constraints
  queryConstraints.push(orderBy('title')); // Order by title for text search
  queryConstraints.push(limit(searchLimit));

  // Add availability filter if requested
  if (filterByAvailability) {
    queryConstraints.push(where('availableQuantity', '>', 0));
  }
  
  // Build queries. Firestore limitations might require separate queries or more complex client-side merging for OR conditions.
  // For simplicity, this example prioritizes title search and then ISBN.
  // A more robust solution might involve a dedicated search service (e.g., Algolia, Typesense) for complex text search.

  // Title search (prefix-like)
  const titleQueryConstraints = [
    ...queryConstraints,
    startAt(searchText), 
    endAt(searchText + '\uf8ff'), 
  ];
  
  // ISBN search (exact match in array)
  const isbnQueryConstraints = [
    where('isbn', 'array-contains', searchText),
    limit(searchLimit) // Apply limit here too
  ];
  if (filterByAvailability) {
    isbnQueryConstraints.push(where('availableQuantity', '>', 0));
  }


  const titleQuery = query(booksRef, ...titleQueryConstraints);
  const isbnQueryLookup = query(booksRef, ...isbnQueryConstraints);
  
  try {
    const [titleSnapshot, isbnSnapshot] = await Promise.all([
      getDocs(titleQuery),
      getDocs(isbnQueryLookup),
    ]);

    const booksMap = new Map<string, Book>();

    titleSnapshot.docs.forEach(docSnap => {
      const bookData = docSnap.data() as Book;
      // Client-side refinement for case-insensitivity for title if Firestore's startAt/endAt is case-sensitive
      if (docSnap.exists() && bookData.title && bookData.title.toLowerCase().startsWith(searchTextLower)) { 
        booksMap.set(docSnap.id, { ...bookData, key: docSnap.id });
      }
    });

    isbnSnapshot.docs.forEach(docSnap => {
      if (docSnap.exists()) { // ISBN match is exact so no further client-side check needed
         booksMap.set(docSnap.id, { ...docSnap.data(), key: docSnap.id } as Book);
      }
    });
    
    return Array.from(booksMap.values()).slice(0, searchLimit); // Ensure final limit

  } catch (error) {
    console.error("Error searching library books:", error);
    return [];
  }
}


    