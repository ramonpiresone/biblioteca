
"use client";

import type { Book } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  addFavorite as fbAddFavorite,
  removeFavorite as fbRemoveFavorite,
  getFavoriteBooks as fbGetFavoriteBooks,
} from '@/services/bookService'; // Assuming isFavorite check is derived from local state

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Book[]>([]);
  const [isLoaded, setIsLoaded] = useState(false); // Tracks initial load from Firestore
  const [isLoading, setIsLoading] = useState(false); // Tracks ongoing operations

  const fetchFavorites = useCallback(async () => {
    if (user) {
      setIsLoading(true);
      setIsLoaded(false); // Reset loaded state during fetch
      try {
        const firestoreFavorites = await fbGetFavoriteBooks(user.uid);
        setFavorites(firestoreFavorites);
      } catch (error) {
        console.error("Failed to load favorites from Firestore", error);
        setFavorites([]); // Reset to empty on error
      } finally {
        setIsLoading(false);
        setIsLoaded(true);
      }
    } else {
      setFavorites([]);
      setIsLoaded(true); // No user, so "loaded" empty state
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addFavorite = useCallback(async (book: Book) => {
    if (!user) {
      console.warn("User not logged in, cannot add favorite.");
      return;
    }
    setIsLoading(true);
    try {
      // Optimistic update
      setFavorites((prevFavorites) => {
        if (prevFavorites.find(fav => fav.key === book.key)) {
          return prevFavorites;
        }
        return [...prevFavorites, book];
      });
      await fbAddFavorite(user.uid, book);
      // Optionally re-fetch to ensure consistency, or rely on optimistic update.
      // await fetchFavorites(); // Uncomment if strict consistency is needed over optimistic UI
    } catch (error) {
      console.error("Failed to add favorite to Firestore", error);
      // Revert optimistic update on error
      setFavorites((prevFavorites) => prevFavorites.filter(fav => fav.key !== book.key));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const removeFavorite = useCallback(async (bookKey: string) => {
    if (!user) {
      console.warn("User not logged in, cannot remove favorite.");
      return;
    }
    setIsLoading(true);
    try {
      // Optimistic update
      const originalFavorites = favorites;
      setFavorites((prevFavorites) => prevFavorites.filter(fav => fav.key !== bookKey));
      await fbRemoveFavorite(user.uid, bookKey);
      // Optionally re-fetch.
      // await fetchFavorites();
    } catch (error: unknown) {
      console.error("Failed to remove favorite from Firestore", error);
      // Revert optimistic update
      setFavorites((prevFavorites) => {
         // This needs to be careful not to re-add if it was already gone or multiple calls happen
         // A more robust revert would use the state *before* this attempt.
         // For now, just refetching is safer on error
         fetchFavorites();
         return prevFavorites; // or return originalFavorites if captured correctly
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, favorites, fetchFavorites]);

  const isFavorite = useCallback((bookKey: string): boolean => {
    return favorites.some(fav => fav.key === bookKey);
  }, [favorites]);

  return { 
    favorites, 
    addFavorite, 
    removeFavorite, 
    isFavorite, 
    isLoaded, // Use this to know if initial fetch is done
    isLoading // Use this for ongoing add/remove operations
  };
}
