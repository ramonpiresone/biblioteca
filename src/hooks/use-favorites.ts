
"use client";

import type { Book } from '@/types';
import { useState, useEffect, useCallback } from 'react';

const FAVORITES_KEY = 'bibliotech_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Book[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedFavorites = localStorage.getItem(FAVORITES_KEY);
        if (storedFavorites) {
          setFavorites(JSON.parse(storedFavorites));
        }
      } catch (error) {
        console.error("Failed to load favorites from localStorage", error);
        setFavorites([]);
      }
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error("Failed to save favorites to localStorage", error);
      }
    }
  }, [favorites, isLoaded]);

  const addFavorite = useCallback((book: Book) => {
    setFavorites((prevFavorites) => {
      if (prevFavorites.find(fav => fav.key === book.key)) {
        return prevFavorites; // Already a favorite
      }
      return [...prevFavorites, book];
    });
  }, []);

  const removeFavorite = useCallback((bookKey: string) => {
    setFavorites((prevFavorites) => prevFavorites.filter(fav => fav.key !== bookKey));
  }, []);

  const isFavorite = useCallback((bookKey: string) => {
    return favorites.some(fav => fav.key === bookKey);
  }, [favorites]);

  return { favorites, addFavorite, removeFavorite, isFavorite, isLoaded };
}
