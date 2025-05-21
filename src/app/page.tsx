
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

  const performSearch = useCallback(async (currentQuery: string, signal: AbortSignal) => {
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
      const books = await searchBooks(currentQuery, 20, signal);
      if (!signal.aborted) {
        setResults(books);
      }
    } catch (e: any) { // Catching AbortError is handled in searchBooks
      if (e.name !== 'AbortError') {
        console.error("Search failed:", e);
        if (!signal.aborted) {
          setError("Falha ao buscar livros. Por favor, tente novamente mais tarde.");
          setResults([]);
        }
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    if (initialLoad && debouncedQuery === '') {
      setInitialLoad(false); 
      setIsLoading(false); // Ensure loading is false if no search is performed
      setResults([]); // Ensure results are empty if no search
      setError(null); // Ensure no error if no search
      return;
    }
    
    performSearch(debouncedQuery, signal);

    return () => {
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [debouncedQuery, initialLoad]); // performSearch is stable due to useCallback with empty deps
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-center text-primary">Bem-vindo ao BiblioTech Lite</h1>
      <p className="text-center text-muted-foreground">
        Explore uma vasta coleção de livros. Pesquise e adicione aos favoritos.
      </p>
      
      <BookSearch query={query} setQuery={setQuery} placeholder="Buscar por título, autor ou ISBN..."/>

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

      {!isLoading && !error && results.length > 0 && (
        <BookList books={results} />
      )}
      
      {!isLoading && !error && results.length === 0 && query.trim() === '' && !initialLoad && (
         <p className="text-center text-muted-foreground mt-8">Comece a digitar para buscar livros.</p>
      )}
    </div>
  );
}
