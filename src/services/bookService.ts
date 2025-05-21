
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
 * @param book The book object from OpenLibrary search or similar source.
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
      
      const bookDataForFirestore: Partial<Book> = {
        key: book.key,
        title: book.title,
        author_name: book.author_name || [],
        first_publish_year: book.first_publish_year,
        isbn: book.isbn || [],
        cover_i: book.cover_i,
        olid: book.olid,
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
            // Optionally re-merge other fields if they might be updated from source
            title: book.title, // ensure title is up-to-date
            author_name: book.author_name || [],
            // ... other fields from bookDataForFirestore if necessary
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
      console.error(`No details found for ISBN: ${isbn} or missing key.`);
      return null;
    }
    
    // The book key from OpenLibrary /books/OL...M needs to be normalized, e.g. /works/OL...W or use ISBN as key if unique enough
    // For simplicity, using the direct key from bookDetailsAPI.key assuming it's suitable
    const bookKey = bookDetailsAPI.key.startsWith('/') ? bookDetailsAPI.key : `/books/${bookDetailsAPI.key}`;

    const bookRef = doc(db, 'books', bookKey);

    const authors = bookDetailsAPI.authors?.map(a => a.name) || [];
    const bookData: Book = {
      key: bookKey,
      title: bookDetailsAPI.title,
      author_name: authors,
      first_publish_year: bookDetailsAPI.publish_date ? parseInt(bookDetailsAPI.publish_date.split(', ')[1] || bookDetailsAPI.publish_date, 10) : undefined,
      isbn: bookDetailsAPI.identifiers?.isbn_13 || bookDetailsAPI.identifiers?.isbn_10 || [isbn],
      cover_url_small: bookDetailsAPI.cover?.small,
      cover_url_medium: bookDetailsAPI.cover?.medium,
      cover_url_large: bookDetailsAPI.cover?.large,
      olid: bookDetailsAPI.identifiers?.openlibrary?.[0],
      description: bookDetailsAPI.subtitle || bookDetailsAPI.notes,
      quantity: quantity,
      availableQuantity: quantity, // When admin adds, all are available initially
      lastAccessedAt: serverTimestamp() as Timestamp,
    };
    
    await setDoc(bookRef, bookData, { merge: true }); // Merge true to update if exists
    console.log(`Book ${bookKey} added/updated by admin with quantity ${quantity}.`);
    
    // Fetch the document to return the complete Book object with server-generated timestamp
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
 * @param book The book to add to favorites.
 */
export async function addFavorite(userId: string, book: Book): Promise<void> {
  if (!userId || !book || !book.key) {
    console.error('addFavorite called with invalid parameters');
    return;
  }
  await ensureBookExists(book); // Ensure basic book record exists
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
 * @param bookKey The key of the book to remove from favorites.
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
 * @param bookKey The key of the book to check.
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
