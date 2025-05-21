
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Search, Loader2, BookCheck } from 'lucide-react';
// Removed Timestamp import from 'firebase/firestore' as it's handled in server action

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { searchLibraryBooks } from '@/services/bookService';
import { createLoan, type CreateLoanInput } from '@/services/loanService';
import type { Book } from '@/types';
import { cn } from '@/lib/utils';

const createLoanSchema = z.object({
  borrowerCPF: z.string().min(11, { message: "CPF deve ter pelo menos 11 dígitos." }).max(14, { message: "CPF inválido."})
    .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: "Formato de CPF inválido. Use XXX.XXX.XXX-XX ou XXXXXXXXXXX."}),
  dueDate: z.date({
    required_error: "Data de devolução é obrigatória.",
  }),
  bookKey: z.string().min(1, { message: "Selecione um livro."}),
  bookTitle: z.string().min(1), // Hidden field, populated on book selection
});

type CreateLoanFormValues = z.infer<typeof createLoanSchema>;

export function CreateLoanForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const debouncedBookSearchQuery = useDebounce(bookSearchQuery, 500);

  const form = useForm<CreateLoanFormValues>({
    resolver: zodResolver(createLoanSchema),
    defaultValues: {
      borrowerCPF: '',
      dueDate: undefined,
      bookKey: '',
      bookTitle: '',
    },
  });

  const handleSearchBooks = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearchingBooks(true);
    try {
      // searchLibraryBooks defaults to filterByAvailability: true
      const books = await searchLibraryBooks(query);
      setSearchResults(books);
    } catch (error) {
      console.error("Erro ao buscar livros da biblioteca:", error);
      toast({
        title: "Erro na Busca",
        description: "Não foi possível buscar livros. Tente novamente.",
        variant: "destructive",
      });
      setSearchResults([]);
    } finally {
      setIsSearchingBooks(false);
    }
  }, [toast]);

  useEffect(() => {
    handleSearchBooks(debouncedBookSearchQuery);
  }, [debouncedBookSearchQuery, handleSearchBooks]);

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    form.setValue('bookKey', book.key);
    form.setValue('bookTitle', book.title);
    setBookSearchQuery(''); // Clear search query
    setSearchResults([]); // Clear results
  };

  async function onSubmit(data: CreateLoanFormValues) {
    if (!user) {
      toast({ title: "Erro de Autenticação", description: "Administrador não está logado.", variant: "destructive" });
      return;
    }
    if (!selectedBook) {
      toast({ title: "Livro não selecionado", description: "Por favor, busque e selecione um livro.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const loanInput: CreateLoanInput = {
        userId: user.uid,
        userDisplayName: user.displayName || undefined,
        userEmail: user.email || undefined,
        borrowerCPF: data.borrowerCPF.replace(/[^\d]/g, ""), // Sanitize CPF
        bookKey: selectedBook.key,
        bookTitle: selectedBook.title,
        dueDate: data.dueDate, // Pass dueDate as JS Date object
      };

      await createLoan(loanInput);
      toast({
        title: "Empréstimo Registrado!",
        description: `O livro "${selectedBook.title}" foi emprestado com sucesso.`,
      });
      form.reset();
      setSelectedBook(null);
      setBookSearchQuery('');
      setSearchResults([]);
    } catch (error: any) {
      console.error("Falha ao registrar empréstimo:", error);
      toast({
        title: "Erro ao Registrar Empréstimo",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Registrar Novo Empréstimo</CardTitle>
        <CardDescription>Preencha os dados abaixo para registrar um novo empréstimo. A data de início do empréstimo será a data atual.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="borrowerCPF"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF do Mutuário</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 123.456.789-00 ou 12345678900" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Devolução Prevista</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) } // Disable past dates
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="bookKey" // This field is for validation, value set by book selection
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Livro</FormLabel>
                  {selectedBook ? (
                    <div className="flex items-center justify-between p-3 border rounded-md bg-muted">
                      <div>
                        <p className="font-medium">{selectedBook.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedBook.author_name?.join(', ') || 'Autor Desconhecido'}
                        </p>
                        <p className="text-sm text-green-600">
                            Disponível: {selectedBook.availableQuantity}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedBook(null);
                        form.setValue('bookKey', '');
                        form.setValue('bookTitle', '');
                      }}>
                        Alterar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar livro por título ou ISBN no acervo (somente disponíveis)..."
                          value={bookSearchQuery}
                          onChange={(e) => setBookSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                        {isSearchingBooks && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin" />}
                      </div>
                      {searchResults.length > 0 && (
                        <ScrollArea className="h-[150px] w-full rounded-md border mt-2">
                          <div className="p-2 space-y-1">
                            {searchResults.map((book) => (
                              <Button
                                key={book.key}
                                variant="ghost"
                                className="w-full justify-start h-auto py-2 text-left"
                                onClick={() => handleSelectBook(book)}
                                disabled={!book.availableQuantity || book.availableQuantity <= 0}
                              >
                                <div>
                                  <p className="font-medium">{book.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {book.author_name?.join(', ') || 'Autor Desconhecido'} - ISBN: {book.isbn?.join(', ') || 'N/A'}
                                  </p>
                                  <p className={cn(
                                      "text-xs",
                                      book.availableQuantity && book.availableQuantity > 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                    Disponível: {book.availableQuantity ?? 0}
                                  </p>
                                </div>
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                      {debouncedBookSearchQuery && !isSearchingBooks && searchResults.length === 0 && (
                         <p className="text-sm text-muted-foreground mt-2">Nenhum livro disponível encontrado para "{debouncedBookSearchQuery}".</p>
                      )}
                    </>
                  )}
                  <FormMessage /> {/* For bookKey validation error */}
                </FormItem>
              )}
            />


            <Button type="submit" disabled={isSubmitting || !selectedBook} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando Empréstimo...
                </>
              ) : (
                <>
                  <BookCheck className="mr-2 h-4 w-4" />
                  Registrar Empréstimo
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

