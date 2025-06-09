
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import type { FirestoreUser } from '@/types';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, UserCredential } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { upsertUser, getFirestoreUser } from '@/services/userService';

interface AuthContextType {
  user: FirebaseUser | null;
  firestoreUser: FirestoreUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<UserCredential | void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await upsertUser(currentUser); // Upsert basic Firebase Auth info
          const fsUser = await getFirestoreUser(currentUser.uid); // Fetch full Firestore user data
          setFirestoreUser(fsUser);
        } catch (error) {
          console.error("Error during user data synchronization:", error);
          setFirestoreUser(null); // Ensure consistent state on error
        }
      } else {
        setFirestoreUser(null); // Clear Firestore user on logout
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle setting user, firestoreUser, and loading state
      return result;
    } catch (error) {
      console.error("Error signing in with Google", error);
      setLoading(false); // Ensure loading is false on sign-in error
      // Potentially show a toast to the user here
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFirestoreUser(null);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out", error);
       // Potentially show a toast to the user here
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, firestoreUser, loading, signInWithGoogle, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
