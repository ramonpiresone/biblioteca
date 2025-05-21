// This file will typically be called from client-side contexts or hooks.

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
} from 'firebase/firestore';
import type { Loan } from '@/types';

/**
 * Creates a new loan record in Firestore.
 * @param loanData Data for the new loan, excluding id, loanDate, status, and createdAt.
 * @returns The ID of the newly created loan document.
 */
export async function createLoan(
  loanData: Omit<Loan, 'id' | 'loanDate' | 'status' | 'createdAt'>
): Promise<string> {
  const loanWithTimestamps: Omit<Loan, 'id'> = {
    ...loanData,
    loanDate: serverTimestamp() as Timestamp,
    status: 'active',
    createdAt: serverTimestamp() as Timestamp,
  };
  const docRef = await addDoc(collection(db, 'loans'), loanWithTimestamps);
  return docRef.id;
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
 * @param loanId The ID of the loan to mark as returned.
 */
export async function returnBook(loanId: string): Promise<void> {
  if (!loanId) {
    console.error("returnBook called with invalid loanId");
    return;
  }
  const loanRef = doc(db, 'loans', loanId);
  await updateDoc(loanRef, {
    status: 'returned',
    returnDate: serverTimestamp() as Timestamp,
  });
}
