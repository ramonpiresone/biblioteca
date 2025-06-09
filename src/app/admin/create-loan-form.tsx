'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Search, Loader2, BookCheck } from 'lucide-react';
// Removed Timestamp import from 'firebase/firestore' as it's handled in server action

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { validateCPF } from '@/lib/validation';

const createLoanSchema = z.object({
  studentName: z.string()
    .min(3, { message: "Nome do estudante deve ter pelo menos 3 caracteres." })
    .max(100, { message: "Nome do estudante não pode ter mais que 100 caracteres." }),
  studentCPF: z.string()
    .min(11, { message: "CPF deve ter 11 dígitos." })
    .max(14, { message: "CPF não pode ter mais que 14 caracteres." })
    .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: "Formato de CPF inválido. Use XXX.XXX.XXX-XX ou XXXXXXXXXXX." })
    .refine((cpf) => validateCPF(cpf), { message: "CPF inválido. Verifique os dígitos." }),
  dueDate: z.date({
    required_error: "Data de devolução é obrigatória.",
  }).refine(
    (date) => {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 60); // Máximo de 60 dias
      return date <= maxDate;
    },
    { message: "Data de devolução não pode ser maior que 60 dias." }
  ),
  bookKey: z.string().min(1, { message: "Selecione um livro."}),
  bookTitle: z.string().min(1), // Hidden field, populated on book selection
});

type CreateLoanFormValues = z.infer<typeof createLoanSchema>;

export function CreateLoanForm(): JSX.Element {
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
      studentName: '',
      studentCPF: '',
      dueDate: undefined,
      bookKey: '',
      bookTitle: '',
    },
  });

  const handleSearchBooks = useCallback(async (query: string): Promise<void> => {
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

  const handleSelectBook = (book: Book): void => {
    setSelectedBook(book);
    form.setValue('bookKey', book.key);
    form.setValue('bookTitle', book.title);
    setBookSearchQuery(''); // Clear search query
    setSearchResults([]); // Clear results
  };

  async function onSubmit(data: CreateLoanFormValues): Promise<void> {
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
        adminId: user.uid,
        adminName: user.displayName || undefined,
        adminEmail: user.email || undefined,
        studentName: data.studentName.trim(),
        studentCPF: data.studentCPF.replace(/[^\d]/g, ""), // Sanitize CPF
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
    } catch (error: Error | unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro.';
      console.error("Falha ao registrar empréstimo:", error);
      toast({
        title: "Erro ao Registrar Empréstimo",
        description: errorMessage,
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
            {user && (
              <div className="p-4 bg-muted rounded-lg mb-6">
                <h3 className="text-sm font-medium mb-2">Administrador Responsável</h3>
                <p className="text-sm text-muted-foreground">{user.displayName || 'Nome não definido'}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            )}
            
            <FormField
              control={form.control}
              name="studentName"
              render={({ field }): JSX.Element => (
                <FormItem>
                  <FormLabel>Nome do Estudante</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome completo do estudante"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="studentCPF"
              render={({ field }): JSX.Element => (
                <FormItem>
                  <FormLabel>CPF do Estudante</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 123.456.789-00"
                      value={field.value}
                      onChange={(e): void => {
                        let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
                        if (value.length <= 11) { // Limita a 11 dígitos
                          // Aplica a máscara
                          if (value.length > 9) {
                            value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, '$1.$2.$3-$4');
                          } else if (value.length > 6) {
                            value = value.replace(/^(\d{3})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
                          } else if (value.length > 3) {
                            value = value.replace(/^(\d{3})(\d{0,3}).*/, '$1.$2');
                          }
                          field.onChange(value);
                        }
                      }}
                      className="font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }): JSX.Element => (
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
                        disabled={(date: Date): boolean => {
                          const today = new Date(new Date().setHours(0,0,0,0));
                          const maxDate = new Date(today);
                          maxDate.setDate(maxDate.getDate() + 60);
                          return date < today || date > maxDate;
                        }} // Disable past dates and dates more than 60 days in the future
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
              render={(): JSX.Element => (
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
                      <Button variant="outline" size="sm" onClick={(): void => {
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
                          onChange={(e): void => setBookSearchQuery(e.target.value)}
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
                                onClick={(): void => handleSelectBook(book)}
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
                         <p className="text-sm text-muted-foreground mt-2">Nenhum livro disponível encontrado para &quot;{debouncedBookSearchQuery}&quot;.</p>
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

