
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Book } from '@/types';
import { getAllLibraryBooks } from '@/services/bookService';
import { BookSearch } from '@/app/(components)/book-search';
import { BookList } from '@/app/(components)/book-list';
import { Loader } from '@/components/ui/loader';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, BookHeart } from 'lucide-react';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [displayedBooks, setDisplayedBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllBooks = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const books = await getAllLibraryBooks();
        setAllBooks(books);
        setDisplayedBooks(books);
      } catch (e: any) {
        console.error("Falha ao buscar todos os livros:", e);
        setError("Não foi possível carregar o catálogo de livros. Por favor, tente recarregar a página.");
        setAllBooks([]);
        setDisplayedBooks([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllBooks();
  }, []);

  useEffect(() => {
    if (query.trim() === '') {
      setDisplayedBooks(allBooks);
      return;
    }

    const lowerCaseQuery = query.toLowerCase();
    const filtered = allBooks.filter(book => {
      const titleMatch = book.title.toLowerCase().includes(lowerCaseQuery);
      const authorMatch = book.author_name?.some(author => author.toLowerCase().includes(lowerCaseQuery));
      const isbnMatch = book.isbn?.some(isbn => isbn.includes(lowerCaseQuery));
      return titleMatch || authorMatch || isbnMatch;
    });
    setDisplayedBooks(filtered);
  }, [query, allBooks]);
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-center text-primary">Bem-vindo ao Projeto Biblioteca</h1>
      <p className="text-center text-muted-foreground">
        Explore o nosso acervo de livros. Pesquise e adicione aos favoritos.
      </p>
      
      <BookSearch query={query} setQuery={setQuery} placeholder="Buscar no acervo por título, autor ou ISBN..."/>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-10">
          <Loader size={48} />
          <p className="mt-4 text-muted-foreground">Carregando acervo de livros...</p>
        </div>
      )}
      
      {error && !isLoading && (
        <Alert variant="destructive" className="my-8">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Livros</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && allBooks.length === 0 && (
         <div className="text-center py-10">
            <BookHeart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum livro encontrado em nosso acervo no momento.</p>
            <p className="text-sm text-muted-foreground mt-1">Administradores podem adicionar livros na seção "Gerenciar".</p>
         </div>
      )}
      
      {!isLoading && !error && displayedBooks.length === 0 && query.trim() !== '' && (
         <p className="text-center text-muted-foreground mt-8">Nenhum livro encontrado no acervo para &quot;{query}&quot;.</p>
      )}

      {!isLoading && !error && displayedBooks.length > 0 && (
        <BookList books={displayedBooks} />
      )}
      
    </div>
  );
}
