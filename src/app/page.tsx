
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Book } from '@/types';
import { searchBooks } from '@/lib/open-library';
import { useDebounce } from '@/hooks/use-debounce';
import { BookSearch } from '@/app/(components)/book-search';
import { BookList } from '@/app/(components)/book-list';
import { Loader } from '@/components/ui/loader';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const debouncedQuery = useDebounce(query, 500);

  const performSearch = useCallback(async (currentQuery: string) => {
    if (!currentQuery.trim()) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      setInitialLoad(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setInitialLoad(false);

    try {
      const books = await searchBooks(currentQuery);
      setResults(books);
    } catch (e) {
      console.error("Search failed:", e);
      setError("Falha ao buscar livros. Por favor, tente novamente mais tarde.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial "empty" search to show some default books or handle initial state
    if (initialLoad && debouncedQuery === '') {
      // You could fetch some popular books here by default if desired
      // For now, just sets initialLoad to false to avoid loading state on first render
      setInitialLoad(false); 
      return;
    }
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch, initialLoad]);
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-center text-primary">Bem-vindo ao BiblioTech Lite</h1>
      <p className="text-center text-muted-foreground">
        Explore uma vasta coleção de livros. Pesquise e adicione aos favoritos.
      </p>
      
      <BookSearch query={query} setQuery={setQuery} />

      {isLoading && <Loader className="my-8" size={48} />}
      
      {error && !isLoading && (
        <Alert variant="destructive" className="my-8">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Erro na Busca</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && results.length === 0 && !initialLoad && query.trim() !== '' && (
         <p className="text-center text-muted-foreground mt-8">Nenhum livro encontrado para &quot;{query}&quot;.</p>
      )}

      {!isLoading && !error && (results.length > 0 || (initialLoad && query === '')) && (
        <BookList books={results} />
      )}
      
      {!isLoading && !error && results.length === 0 && query.trim() === '' && !initialLoad && (
         <p className="text-center text-muted-foreground mt-8">Comece a digitar para buscar livros.</p>
      )}
    </div>
  );
}
