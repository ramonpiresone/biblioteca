// This file will typically be called from client-side contexts or hooks.
// If used in Server Components or Server Actions, add 'use server';

import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { FirestoreUser } from '@/types';
import type { User as FirebaseUser } from 'firebase/auth';

/**
 * Creates a new user document in Firestore if one doesn't already exist for the given UID,
 * or updates the existing user's displayName, photoURL, and updatedAt timestamp.
 * New users are assigned `roles: { admin: false }`.
 * @param firebaseUser The Firebase Auth user object.
 */
export async function upsertUser(firebaseUser: FirebaseUser): Promise<void> {
  if (!firebaseUser) {
    console.error("upsertUser called with null firebaseUser");
    return;
  }
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  const userData: Partial<FirestoreUser> = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    updatedAt: serverTimestamp() as Timestamp, // Cast because serverTimestamp is a sentinel
  };

  if (!userSnap.exists()) {
    // New user
    const newUser: FirestoreUser = {
      ...userData,
      roles: { admin: false },
      createdAt: serverTimestamp() as Timestamp, // Cast
    } as FirestoreUser; // Ensure all fields for FirestoreUser are present
    await setDoc(userRef, newUser);
    console.log(`New user created with UID: ${firebaseUser.uid}`);
  } else {
    // Existing user, update specific fields
    await setDoc(userRef, userData, { merge: true });
    console.log(`User updated with UID: ${firebaseUser.uid}`);
  }
}
