
"use client";

import { useFavorites } from '@/hooks/use-favorites';
import { BookList } from '@/app/(components)/book-list';
import { Loader } from '@/components/ui/loader';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function FavoritesPage() {
  const { favorites, isLoaded, isLoading } = useFavorites(); // isLoading for ongoing, isLoaded for initial

  // Show loader if initial data isn't loaded OR an operation is in progress
  if (!isLoaded || isLoading) {
    return <Loader className="my-8" size={48} />;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-primary">Seus Livros Favoritos</h1>
      {favorites.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">Você ainda não adicionou nenhum livro aos seus favoritos.</p>
          <Button asChild>
            <Link href="/">Explorar Livros</Link>
          </Button>
        </div>
      ) : (
        <BookList books={favorites} />
      )}
    </div>
  );
}
