
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
  // book.key is expected to be the plain OLID (e.g., OL123M or OL456W)
  const bookRef = doc(db, 'books', book.key);
  
  try {
    await runTransaction(db, async (transaction) => {
      const bookSnap = await transaction.get(bookRef);
      
      const bookDataForFirestore: Partial<Book> = {
        key: book.key, // Storing the OLID as the key field as well
        title: book.title,
        author_name: book.author_name || [],
        first_publish_year: book.first_publish_year,
        isbn: book.isbn || [],
        cover_i: book.cover_i,
        olid: book.olid, // This might be redundant if key is always the OLID we care about
        cover_url_small: book.cover_url_small,
        cover_url_medium: book.cover_url_medium,
        cover_url_large: book.cover_url_large,
        description: book.description,
        lastAccessedAt: serverTimestamp() as Timestamp,
      };

      if (!bookSnap.exists()) {
        // If book doesn't exist, set it with basic info. Quantity is not set here.
        transaction.set(bookRef, bookDataForFirestore);
      } else {
        // If book exists, only update lastAccessedAt and ensure core fields are merged.
        transaction.set(bookRef, 
          { 
            lastAccessedAt: serverTimestamp() as Timestamp,
            title: book.title, 
            author_name: book.author_name || [],
            // Optionally re-merge other fields if they might be updated from source
            isbn: book.isbn || [],
            cover_i: book.cover_i,
            olid: book.olid,
            cover_url_small: book.cover_url_small,
            cover_url_medium: book.cover_url_medium,
            cover_url_large: book.cover_url_large,
            description: book.description,
          }, 
          { merge: true }
        );
      }
    });
  } catch (error) {
    console.error("Transaction failed for ensureBookExists: ", error);
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
    
    // Extract the OLID (e.g., OLXXXXM) from the full key path (e.g., /books/OLXXXXM or /works/OLXXXXW)
    // This OLID will be used as the Firestore document ID.
    const firestoreBookKey = bookDetailsAPI.key.split('/').pop();
    if (!firestoreBookKey) {
        console.error(`Could not extract OLID from bookDetailsAPI.key: ${bookDetailsAPI.key}`);
        return null;
    }

    const bookRef = doc(db, 'books', firestoreBookKey);

    const authors = bookDetailsAPI.authors?.map(a => a.name) || [];
    // Attempt to parse publish year. API returns full date string like "Oct 20, 2017" or just "2017".
    let publishYear: number | undefined = undefined;
    if (bookDetailsAPI.publish_date) {
        const yearMatch = bookDetailsAPI.publish_date.match(/\d{4}/);
        if (yearMatch) {
            publishYear = parseInt(yearMatch[0], 10);
        }
    }

    const bookData: Book = {
      key: firestoreBookKey, // Use the extracted OLID as the key field in the document data
      title: bookDetailsAPI.title,
      author_name: authors,
      first_publish_year: publishYear,
      isbn: bookDetailsAPI.identifiers?.isbn_13 || bookDetailsAPI.identifiers?.isbn_10 || [isbn],
      cover_url_small: bookDetailsAPI.cover?.small,
      cover_url_medium: bookDetailsAPI.cover?.medium,
      cover_url_large: bookDetailsAPI.cover?.large,
      // Use the extracted OLID for the olid field as well for consistency if it's an edition OLID
      olid: firestoreBookKey.startsWith('OL') ? firestoreBookKey : (bookDetailsAPI.identifiers?.openlibrary?.[0]),
      description: bookDetailsAPI.subtitle || bookDetailsAPI.notes, // Prefer subtitle if available
      quantity: quantity,
      availableQuantity: quantity,
      lastAccessedAt: serverTimestamp() as Timestamp,
    };
    
    await setDoc(bookRef, bookData, { merge: true });
    console.log(`Book ${firestoreBookKey} added/updated by admin with quantity ${quantity}.`);
    
    const savedBookSnap = await getDoc(bookRef);
    if (savedBookSnap.exists()) {
        return { ...savedBookSnap.data(), key: savedBookSnap.id } as Book; // Ensure key is the doc ID
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
  // book.key is the OLID, used as document ID in 'favorites' subcollection
  const favoriteRef = doc(db, 'users', userId, 'favorites', book.key); 
  const favoriteData: FavoriteRecord = {
    bookKey: book.key, // Storing the OLID here as well
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
    .map((docSnap) => (docSnap.data() as FavoriteRecord).bookKey) // These keys are OLIDs
    .filter(key => !!key); 

  if (favoriteBookKeys.length === 0) {
    return [];
  }

  const books: Book[] = [];
  // Firestore 'in' queries are limited to 30 elements in the array
  const CHUNK_SIZE = 30; 
  for (let i = 0; i < favoriteBookKeys.length; i += CHUNK_SIZE) {
      const chunk = favoriteBookKeys.slice(i, i + CHUNK_SIZE);
      if (chunk.length > 0) {
        // Query 'books' collection where document ID is in the chunk of OLIDs
        const booksQuery = query(collection(db, 'books'), where(documentId(), 'in', chunk));
        const booksSnapshot = await getDocs(booksQuery);
        booksSnapshot.forEach((bookDoc) => {
        if (bookDoc.exists()) {
            // bookDoc.id is the OLID, which should match bookDoc.data().key
            books.push({ ...bookDoc.data(), key: bookDoc.id } as Book);
        }
        });
      }
  }
  
  // Sort the fetched books based on the original favoritedAt order
  const sortedBooks = books.sort((a, b) => {
    const aIndex = favoriteBookKeys.indexOf(a.key); // a.key is OLID
    const bIndex = favoriteBookKeys.indexOf(b.key); // b.key is OLID
    return aIndex - bIndex;
  });

  return sortedBooks;
}
