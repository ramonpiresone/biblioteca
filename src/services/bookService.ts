// This file will typically be called from client-side contexts or hooks.

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
} from 'firebase/firestore';
import type { Book, FavoriteRecord } from '@/types';

/**
 * Ensures a book exists in the top-level 'books' collection.
 * If it doesn't exist, it's added. Updates `lastAccessedAt` timestamp.
 * @param book The book object.
 */
export async function ensureBookExists(book: Book): Promise<void> {
  if (!book || !book.key) {
    console.error('ensureBookExists called with invalid book data');
    return;
  }
  const bookRef = doc(db, 'books', book.key);
  const bookSnap = await getDoc(bookRef);

  const bookDataForFirestore = {
    ...book,
    lastAccessedAt: serverTimestamp() as Timestamp,
  };

  if (!bookSnap.exists()) {
    await setDoc(bookRef, bookDataForFirestore);
  } else {
    // Update lastAccessedAt if book already exists
    await setDoc(bookRef, { lastAccessedAt: serverTimestamp() as Timestamp }, { merge: true });
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
    .filter(key => !!key); // Ensure keys are valid

  if (favoriteBookKeys.length === 0) {
    return [];
  }

  const books: Book[] = [];
  // Firestore 'in' query limit is 30. If more, batching is needed.
  // For simplicity, this example fetches one by one, or in chunks if many.
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
  
  // Sort books according to the original favoritedAt order
  const sortedBooks = books.sort((a, b) => {
    const aIndex = favoriteBookKeys.indexOf(a.key);
    const bIndex = favoriteBookKeys.indexOf(b.key);
    return aIndex - bIndex;
  });

  return sortedBooks;
}
