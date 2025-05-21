
"use client";

import type { Book } from '@/types';
import { useFavorites } from '@/hooks/use-favorites';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FavoritesToggleButtonProps {
  book: Book;
  className?: string;
}

export function FavoritesToggleButton({ book, className }: FavoritesToggleButtonProps) {
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const favorite = isFavorite(book.key);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when clicking button
    if (favorite) {
      removeFavorite(book.key);
    } else {
      addFavorite(book);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleFavorite}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      className={cn("text-muted-foreground hover:text-destructive", favorite && "text-destructive", className)}
      title={favorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart fill={favorite ? 'currentColor' : 'none'} className="h-5 w-5" />
    </Button>
  );
}
