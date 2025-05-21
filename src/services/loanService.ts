
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
import type { Loan, Book } from '@/types'; 

// Define a more specific input type for creating loans
export interface CreateLoanInput {
  userId: string; // UID of the user initiating the loan (e.g., admin)
  userDisplayName?: string;
  userEmail?: string;
  borrowerCPF: string; // CPF of the person borrowing the book
  bookKey: string;
  bookTitle: string;
  dueDate: Date; 
}


/**
 * Creates a new loan record in Firestore and decrements book availability.
 * Transactional.
 * @param loanDetails Data for the new loan, including admin's UID and borrower's CPF.
 * @returns The ID of the newly created loan document.
 * @throws Error if the book is not available or other Firestore errors.
 */
export async function createLoan(
  loanDetails: CreateLoanInput
): Promise<string> {
  const bookRef = doc(db, 'books', loanDetails.bookKey);

  try {
    const loanId = await runTransaction(db, async (transaction) => {
      const bookSnap = await transaction.get(bookRef);
      if (!bookSnap.exists()) {
        throw new Error(`Livro com chave ${loanDetails.bookKey} não encontrado.`);
      }

      const bookData = bookSnap.data() as Book;
      if (bookData.availableQuantity === undefined || bookData.availableQuantity <= 0) {
        throw new Error(`Livro "${bookData.title}" não está disponível para empréstimo.`);
      }

      // Decrement available quantity
      transaction.update(bookRef, {
        availableQuantity: bookData.availableQuantity - 1,
      });

      // Create loan document
      const loanWithTimestamps: Omit<Loan, 'id' | 'loanDate' | 'dueDate' | 'returnDate' | 'createdAt'> & { loanDate: Timestamp, dueDate: Timestamp, returnDate?: Timestamp, createdAt: Timestamp } = {
        userId: loanDetails.userId, // Admin's UID
        userDisplayName: loanDetails.userDisplayName, // Admin's name
        userEmail: loanDetails.userEmail, // Admin's email
        borrowerCPF: loanDetails.borrowerCPF,
        bookKey: loanDetails.bookKey,
        bookTitle: loanDetails.bookTitle,
        dueDate: Timestamp.fromDate(loanDetails.dueDate), // Convert JS Date to Firestore Timestamp here
        loanDate: serverTimestamp() as Timestamp,
        status: 'active',
        createdAt: serverTimestamp() as Timestamp,
      };
      
      const newLoanRef = doc(collection(db, 'loans'));
      transaction.set(newLoanRef, loanWithTimestamps);
      return newLoanRef.id;
    });
    return loanId;
  } catch (error) {
    console.error("Falha ao criar empréstimo:", error);
    throw error; 
  }
}

/**
 * Fetches all loans for a given user, ordered by loan date descending.
 * Converts Timestamps to JS Date objects.
 * @param userId The ID of the user.
 * @returns A promise that resolves to an array of Loan objects with JS Dates.
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

  return loansSnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      loanDate: (data.loanDate as Timestamp)?.toDate(),
      dueDate: (data.dueDate as Timestamp)?.toDate(),
      returnDate: (data.returnDate as Timestamp)?.toDate() || null,
      createdAt: (data.createdAt as Timestamp)?.toDate(),
    } as Loan;
  });
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
    throw new Error("ID do empréstimo é obrigatório.");
  }
  const loanRef = doc(db, 'loans', loanId);

  try {
    await runTransaction(db, async (transaction) => {
      const loanSnap = await transaction.get(loanRef);
      if (!loanSnap.exists()) {
        throw new Error(`Empréstimo com ID ${loanId} não encontrado.`);
      }
      const loanData = loanSnap.data() as Loan; // Assuming this comes with Timestamps initially
      if (loanData.status === 'returned') {
        console.warn(`Empréstimo ${loanId} já está marcado como devolvido.`);
        return;
      }

      const bookRef = doc(db, 'books', loanData.bookKey);
      const bookSnap = await transaction.get(bookRef);
      if (!bookSnap.exists()) {
        throw new Error(`Livro com chave ${loanData.bookKey} associado ao empréstimo ${loanId} não encontrado.`);
      }
      const bookData = bookSnap.data() as Book;

      const newAvailableQuantity = (bookData.availableQuantity ?? 0) + 1;
      transaction.update(bookRef, {
        availableQuantity: Math.min(newAvailableQuantity, bookData.quantity ?? newAvailableQuantity),
      });

      transaction.update(loanRef, {
        status: 'returned',
        returnDate: serverTimestamp() as Timestamp,
      });
    });
  } catch (error) {
    console.error(`Falha ao devolver livro para o empréstimo ${loanId}:`, error);
    throw error; 
  }
}


/**
 * Fetches all loans from the database, ordered by loan date descending.
 * Intended for admin use. Converts Timestamps to JS Date objects.
 * @returns A promise that resolves to an array of Loan objects with JS Dates.
 */
export async function getAllLoans(): Promise<Loan[]> {
  const loansColRef = collection(db, 'loans');
  const q = query(
    loansColRef,
    orderBy('status', 'asc'), 
    orderBy('loanDate', 'desc')
  );
  const loansSnapshot = await getDocs(q);

  return loansSnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    // Convert Firestore Timestamps to JS Date objects
    return {
      id: docSnap.id,
      ...data,
      loanDate: (data.loanDate as Timestamp)?.toDate(),
      dueDate: (data.dueDate as Timestamp)?.toDate(),
      returnDate: (data.returnDate as Timestamp)?.toDate() || null,
      createdAt: (data.createdAt as Timestamp)?.toDate(),
    } as Loan;
  });
}
