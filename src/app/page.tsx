
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Book } from '@/types';
import { searchLibraryBooks } from '@/services/bookService'; // Changed import
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
      // Search local Firestore books, do not filter by availability for home page catalog
      const books = await searchLibraryBooks(currentQuery, 20, false); 
      if (!signal.aborted) {
        setResults(books);
      }
    } catch (e: any) { 
      // AbortError handling can remain for UI responsiveness, even if Firestore SDK doesn't use the signal directly
      if (e.name !== 'AbortError') {
        console.error("Falha na busca:", e);
        if (!signal.aborted) {
          setError("Falha ao buscar livros. Por favor, tente novamente mais tarde.");
          setResults([]);
        }
      } else {
         console.log("Busca abortada (UI).");
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
      setIsLoading(false); 
      setResults([]); 
      setError(null); 
      return;
    }
    
    performSearch(debouncedQuery, signal);

    return () => {
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [debouncedQuery, initialLoad]); 
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-center text-primary">Bem-vindo ao Projeto Biblioteca</h1>
      <p className="text-center text-muted-foreground">
        Explore o nosso acervo de livros. Pesquise e adicione aos favoritos.
      </p>
      
      <BookSearch query={query} setQuery={setQuery} placeholder="Buscar livro no acervo por título ou ISBN..."/>

      {isLoading && <Loader className="my-8" size={48} />}
      
      {error && !isLoading && (
        <Alert variant="destructive" className="my-8">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Erro na Busca</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && results.length === 0 && !initialLoad && query.trim() !== '' && (
         <p className="text-center text-muted-foreground mt-8">Nenhum livro encontrado em nosso acervo para &quot;{query}&quot;.</p>
      )}

      {!isLoading && !error && results.length > 0 && (
        <BookList books={results} />
      )}
      
      {!isLoading && !error && results.length === 0 && query.trim() === '' && !initialLoad && (
         <p className="text-center text-muted-foreground mt-8">Comece a digitar para buscar livros no acervo.</p>
      )}
    </div>
  );
}
