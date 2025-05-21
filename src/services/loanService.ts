
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  runTransaction,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Loan, Book } from '@/types'; // Ensure Book is imported

/**
 * Creates a new loan record in Firestore and decrements book availability.
 * Transactional.
 * @param loanData Data for the new loan. Must include userId, bookKey, bookTitle, dueDate.
 *                 Optional: userDisplayName, userEmail.
 * @returns The ID of the newly created loan document.
 * @throws Error if the book is not available or other Firestore errors.
 */
export async function createLoan(
  loanData: Omit<Loan, 'id' | 'loanDate' | 'status' | 'createdAt' | 'returnDate'>
): Promise<string> {
  const bookRef = doc(db, 'books', loanData.bookKey);

  try {
    const loanId = await runTransaction(db, async (transaction) => {
      const bookSnap = await transaction.get(bookRef);
      if (!bookSnap.exists()) {
        throw new Error(`Book with key ${loanData.bookKey} not found.`);
      }

      const bookData = bookSnap.data() as Book;
      if (bookData.availableQuantity === undefined || bookData.availableQuantity <= 0) {
        throw new Error(`Book "${bookData.title}" is not available for loan.`);
      }

      // Decrement available quantity
      transaction.update(bookRef, {
        availableQuantity: bookData.availableQuantity - 1,
      });

      // Create loan document
      const loanWithTimestamps: Omit<Loan, 'id'> = {
        ...loanData,
        loanDate: serverTimestamp() as Timestamp,
        status: 'active',
        createdAt: serverTimestamp() as Timestamp,
      };
      // Firestore does not return the doc ref inside a transaction when using addDoc
      // So we create a new doc ref first, then set it within the transaction
      const newLoanRef = doc(collection(db, 'loans'));
      transaction.set(newLoanRef, loanWithTimestamps);
      return newLoanRef.id;
    });
    return loanId;
  } catch (error) {
    console.error("Failed to create loan:", error);
    throw error; // Re-throw to be caught by caller
  }
}

/**
 * Fetches all loans for a given user, ordered by loan date descending.
 * @param userId The ID of the user.
 * @returns A promise that resolves to an array of Loan objects.
 */
export async function getUserLoans(userId: string): Promise<Loan[]> {
  if (!userId) return [];

  const loansColRef = collection(db, 'loans');
  const q = query(
    loansColRef,
    where('userId', '==', userId),
    orderBy('loanDate', 'desc')
  );
  const loansSnapshot = await getDocs(q);

  return loansSnapshot.docs.map(
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Loan)
  );
}

/**
 * Updates a loan's status to 'returned' and sets the returnDate.
 * Increments book availability. Transactional.
 * @param loanId The ID of the loan to mark as returned.
 * @throws Error if loan or book not found, or other Firestore errors.
 */
export async function returnBook(loanId: string): Promise<void> {
  if (!loanId) {
    console.error("returnBook called with invalid loanId");
    throw new Error("Loan ID is required.");
  }
  const loanRef = doc(db, 'loans', loanId);

  try {
    await runTransaction(db, async (transaction) => {
      const loanSnap = await transaction.get(loanRef);
      if (!loanSnap.exists()) {
        throw new Error(`Loan with ID ${loanId} not found.`);
      }
      const loanData = loanSnap.data() as Loan;
      if (loanData.status === 'returned') {
        // Already returned, nothing to do
        console.warn(`Loan ${loanId} is already marked as returned.`);
        return;
      }

      const bookRef = doc(db, 'books', loanData.bookKey);
      const bookSnap = await transaction.get(bookRef);
      if (!bookSnap.exists()) {
        // This case should be rare if data integrity is maintained
        throw new Error(`Book with key ${loanData.bookKey} associated with loan ${loanId} not found.`);
      }
      const bookData = bookSnap.data() as Book;

      // Increment available quantity, ensuring it doesn't exceed total quantity
      const newAvailableQuantity = (bookData.availableQuantity ?? 0) + 1;
      transaction.update(bookRef, {
        availableQuantity: Math.min(newAvailableQuantity, bookData.quantity ?? newAvailableQuantity),
      });

      // Update loan status
      transaction.update(loanRef, {
        status: 'returned',
        returnDate: serverTimestamp() as Timestamp,
      });
    });
  } catch (error) {
    console.error(`Failed to return book for loan ${loanId}:`, error);
    throw error; // Re-throw to be caught by caller
  }
}


/**
 * Fetches all loans from the database, ordered by loan date descending.
 * Intended for admin use.
 * @returns A promise that resolves to an array of Loan objects.
 */
export async function getAllLoans(): Promise<Loan[]> {
  const loansColRef = collection(db, 'loans');
  // Order by status first (active loans on top), then by loanDate
  const q = query(
    loansColRef,
    orderBy('status', 'asc'), // 'active' comes before 'returned'
    orderBy('loanDate', 'desc')
  );
  const loansSnapshot = await getDocs(q);

  return loansSnapshot.docs.map(
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Loan)
  );
}
