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
import { LoanValidationError, LoanNotFoundError } from './errors';

// Define a more specific input type for creating loans
export interface CreateLoanInput {
  adminId: string; // UID of the admin creating the loan
  adminName?: string;
  adminEmail?: string;
  studentName: string; // Name of the student
  studentCPF: string; // CPF of the student
  bookKey: string;
  bookTitle: string;
  dueDate: Date; 
}

// Helper function to safely convert Firestore Timestamps or similar objects to JS Dates
const convertToDate = (field: unknown): Date | null => {
  if (!field) return null;
  
  // Se já é uma Data
  if (field instanceof Date) return field;
  
  // Se é um Timestamp do Firestore
  if (typeof field === 'object' && field !== null && 'toDate' in field && typeof field.toDate === 'function') {
    return field.toDate();
  }
  
  // Se é string ou número
  if (typeof field === 'string' || typeof field === 'number') {
    const date = new Date(field);
    if (!isNaN(date.getTime())) return date;
  }
  
  return null;
};

/**
 * Valida os dados de entrada para criação de empréstimo
 * @param loanDetails Dados do empréstimo incluindo informações do estudante e livro
 * @throws Error se os dados do estudante ou livro forem inválidos
 */
function validateLoanInput(loanDetails: CreateLoanInput): void {
  // Validação do administrador
  if (!loanDetails.adminId?.trim()) {
    throw new Error("ID do administrador é obrigatório.");
  }

  // Validação do estudante
  const studentName = loanDetails.studentName?.trim();
  if (!studentName) {
    throw new Error("Nome do estudante é obrigatório.");
  }
  if (studentName.length < 3) {
    throw new Error("Nome do estudante deve ter pelo menos 3 caracteres.");
  }
  if (studentName.length > 100) {
    throw new Error("Nome do estudante não pode ter mais que 100 caracteres.");
  }
  if (!loanDetails.studentCPF) {
    throw new Error("CPF do estudante é obrigatório.");
  }
  if (!validateCPF(loanDetails.studentCPF)) {
    throw new Error("CPF inválido. Por favor, verifique os dígitos.");
  }

  // Validação do livro
  if (!loanDetails.bookKey?.trim()) {
    throw new Error("Livro não selecionado.");
  }
  if (!loanDetails.bookTitle?.trim()) {
    throw new Error("Título do livro é obrigatório.");
  }

  // Validação da data
  if (!loanDetails.dueDate) {
    throw new Error("Data de devolução não informada.");
  }
  if (!(loanDetails.dueDate instanceof Date)) {
    throw new Error("Data de devolução inválida.");
  }
  if (loanDetails.dueDate < new Date()) {
    throw new Error("Data de devolução deve ser no futuro.");
  }
}

/**
 * Creates a new loan record in Firestore and decrements book availability.
 * Transactional.
 * @param loanDetails Data for the new loan, including admin's info and student's data.
 * @returns The ID of the newly created loan document.
 * @throws Error if the book is not available, invalid student data, or other Firestore errors.
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
        adminId: loanDetails.adminId,
        adminName: loanDetails.adminName,
        adminEmail: loanDetails.adminEmail,
        studentName: loanDetails.studentName,
        studentCPF: loanDetails.studentCPF,
        bookKey: loanDetails.bookKey,
        bookTitle: loanDetails.bookTitle,
        dueDate: Timestamp.fromDate(loanDetails.dueDate), // Convert JS Date to Firestore Timestamp
        loanDate: serverTimestamp(), // Firestore server-side timestamp
        status: 'active' as 'active' | 'returned',
        createdAt: serverTimestamp() // Firestore server-side timestamp
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
 * Fetches all loans for a given administrator, ordered by loan date descending.
 * Converts Timestamps to JS Date objects suitable for client components.
 * @param userId The ID of the administrator.
 * @returns A promise that resolves to an array of Loan objects with JS Dates.
 */
export async function getUserLoans(userId: string): Promise<Loan[]> {
  if (!userId) return [];

  const loansColRef = collection(db, 'loans');
  const q = query(
    loansColRef,
    where('adminId', '==', userId), 
    orderBy('loanDate', 'desc')
  );
  const loansSnapshot = await getDocs(q);

  return loansSnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      adminId: data.adminId,
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      studentName: data.studentName,
      studentCPF: data.studentCPF,
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

// These errors have been moved to errors.ts

/**
 * Updates a loan's status to 'returned' and sets the returnDate.
 * Increments book availability. Transactional.
 * @param loanId The ID of the loan to mark as returned.
 * @throws {LoanValidationError} If the loan ID is invalid
 * @throws {LoanNotFoundError} If the loan is not found
 * @throws {Error} For other Firestore errors
 */
export async function returnBook(loanId: string): Promise<void> {
  if (!loanId?.trim()) {
    throw new LoanValidationError("ID do empréstimo é obrigatório.");
  }

  const loanRef = doc(db, 'loans', loanId);

  try {
    await runTransaction(db, async (transaction) => {
      const loanSnap = await transaction.get(loanRef);
      if (!loanSnap.exists()) {
        throw new LoanNotFoundError(loanId);
      }

      const loanData = loanSnap.data();
      if (!loanData) {
        throw new Error(`Dados do empréstimo ${loanId} estão corrompidos`);
      }

      // Validação do status
      if (!loanData.status || !['active', 'returned'].includes(loanData.status)) {
        throw new LoanValidationError(`Status do empréstimo ${loanId} é inválido`);
      }

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
      
      // Garantir que availableQuantity nunca exceda quantity
      const newAvailableQuantity = Math.min(
        (bookData.availableQuantity ?? 0) + 1,
        bookData.quantity ?? Number.MAX_SAFE_INTEGER
      );

      transaction.update(bookRef, {
        availableQuantity: newAvailableQuantity,
        lastAccessedAt: serverTimestamp(),
      });

      transaction.update(loanRef, {
        status: 'returned',
        returnDate: serverTimestamp(),
      });
    });
  } catch (error: unknown) {
    if (error instanceof LoanValidationError || 
        error instanceof LoanNotFoundError) {
      throw error;
    }
    console.error(`Falha ao devolver livro para o empréstimo ${loanId}:`, 
                 error instanceof Error ? error.message : error);
    throw new Error(`Erro ao processar devolução: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      adminId: data.adminId,
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      studentName: data.studentName,
      studentCPF: data.studentCPF,
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
