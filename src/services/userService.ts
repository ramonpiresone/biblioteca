
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
    updatedAt: serverTimestamp() as Timestamp,
  };

  if (!userSnap.exists()) {
    // New user
    const newUser: FirestoreUser = {
      ...userData,
      roles: { admin: false }, // Default role for new users
      createdAt: serverTimestamp() as Timestamp,
    } as FirestoreUser; 
    await setDoc(userRef, newUser);
    console.log(`New user created with UID: ${firebaseUser.uid}`);
  } else {
    // Existing user, update specific fields, but DO NOT overwrite roles
    // Roles should be managed separately, e.g., by an admin panel or specific function
    const existingData = userSnap.data() as FirestoreUser;
    const updateData: Partial<FirestoreUser> = {
      ...userData,
      roles: existingData.roles, // Preserve existing roles
    };
    await setDoc(userRef, updateData, { merge: true });
    console.log(`User updated with UID: ${firebaseUser.uid}`);
  }
}

/**
 * Fetches a Firestore user document by UID.
 * @param uid The user's ID.
 * @returns A promise that resolves to the FirestoreUser object or null if not found.
 */
export async function getFirestoreUser(uid: string): Promise<FirestoreUser | null> {
  if (!uid) {
    console.error("getFirestoreUser called with no UID.");
    return null;
  }
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data() as FirestoreUser;
    } else {
      console.warn(`No Firestore user document found for UID: ${uid}`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching Firestore user:", error);
    return null;
  }
}
