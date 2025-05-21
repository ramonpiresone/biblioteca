'use server';

import { db } from '@/lib/firebase';
import { validateCPF } from '@/lib/validation';
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

// Helper function to safely convert Firestore Timestamps or similar objects to JS Dates
const convertToDate = (field: any): Date | null => {
  if (!field) return null;
  if (field instanceof Date) return field; // Already a Date
  if (typeof field.toDate === 'function') return field.toDate(); // Firestore Timestamp or compatible
  // Attempt to parse if it's a string or number (e.g., seconds from epoch)
  const date = new Date(field);
  if (!isNaN(date.getTime())) return date;
  return null; // Or throw an error if strict conversion is needed
};

/**
 * Valida os dados de entrada para criação de empréstimo
 * @param loanDetails Dados do empréstimo a serem validados
 * @throws Error se os dados forem inválidos
 */
function validateLoanInput(loanDetails: CreateLoanInput): void {
  if (!loanDetails.borrowerCPF || !validateCPF(loanDetails.borrowerCPF)) {
    throw new Error("CPF inválido. Por favor, verifique os dígitos.");
  }
  if (!loanDetails.bookKey) {
    throw new Error("Livro não selecionado.");
  }
  if (!loanDetails.dueDate) {
    throw new Error("Data de devolução não informada.");
  }
  if (loanDetails.dueDate < new Date()) {
    throw new Error("Data de devolução deve ser no futuro.");
  }
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
  // Valida os dados de entrada
  validateLoanInput(loanDetails);

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
      // Firestore expects Timestamps, so convert JS Date for dueDate here. loanDate and createdAt use serverTimestamp.
      const loanDataForFirestore = {
        userId: loanDetails.userId, // Admin's UID
        userDisplayName: loanDetails.userDisplayName, // Admin's name
        userEmail: loanDetails.userEmail, // Admin's email
        borrowerCPF: loanDetails.borrowerCPF,
        bookKey: loanDetails.bookKey,
        bookTitle: loanDetails.bookTitle,
        dueDate: Timestamp.fromDate(loanDetails.dueDate), // Convert JS Date to Firestore Timestamp
        loanDate: serverTimestamp(), // Firestore server-side timestamp
        status: 'active' as 'active' | 'returned',
        createdAt: serverTimestamp(), // Firestore server-side timestamp
      };
      
      const newLoanRef = doc(collection(db, 'loans'));
      transaction.set(newLoanRef, loanDataForFirestore);
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
 * Converts Timestamps to JS Date objects suitable for client components.
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
      userId: data.userId,
      userDisplayName: data.userDisplayName,
      userEmail: data.userEmail,
      borrowerCPF: data.borrowerCPF,
      bookKey: data.bookKey,
      bookTitle: data.bookTitle,
      status: data.status,
      loanDate: convertToDate(data.loanDate)!, // Not null
      dueDate: convertToDate(data.dueDate)!,   // Not null
      returnDate: convertToDate(data.returnDate), // Can be null
      createdAt: convertToDate(data.createdAt)!, // Not null
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
      // Loan data directly from Firestore will have Timestamps if they are Firestore Timestamps
      const loanDataFromFirestore = loanSnap.data(); 
      if (loanDataFromFirestore.status === 'returned') {
        console.warn(`Empréstimo ${loanId} já está marcado como devolvido.`);
        return;
      }

      const bookRef = doc(db, 'books', loanDataFromFirestore.bookKey);
      const bookSnap = await transaction.get(bookRef);
      if (!bookSnap.exists()) {
        throw new Error(`Livro com chave ${loanDataFromFirestore.bookKey} associado ao empréstimo ${loanId} não encontrado.`);
      }
      const bookData = bookSnap.data() as Book;

      const newAvailableQuantity = (bookData.availableQuantity ?? 0) + 1;
      transaction.update(bookRef, {
        availableQuantity: Math.min(newAvailableQuantity, bookData.quantity ?? newAvailableQuantity),
      });

      transaction.update(loanRef, {
        status: 'returned',
        returnDate: serverTimestamp(), // Firestore server-side timestamp
      });
    });
  } catch (error) {
    console.error(`Falha ao devolver livro para o empréstimo ${loanId}:`, error);
    throw error; 
  }
}


/**
 * Fetches all loans from the database, ordered by loan date descending.
 * Intended for admin use. Converts Timestamps to JS Date objects suitable for client components.
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
      userId: data.userId,
      userDisplayName: data.userDisplayName,
      userEmail: data.userEmail,
      borrowerCPF: data.borrowerCPF,
      bookKey: data.bookKey,
      bookTitle: data.bookTitle,
      status: data.status,
      loanDate: convertToDate(data.loanDate)!, // Not null
      dueDate: convertToDate(data.dueDate)!,   // Not null
      returnDate: convertToDate(data.returnDate), // Can be null
      createdAt: convertToDate(data.createdAt)!, // Not null
    } as Loan;
  });
}
