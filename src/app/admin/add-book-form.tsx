
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { useToast } from '@/hooks/use-toast';
import { adminAddBook } from '@/services/bookService';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


const addBookSchema = z.object({
  isbn: z.string().min(10, { message: "ISBN deve ter pelo menos 10 caracteres." })
                 .max(13, { message: "ISBN não pode ter mais que 13 caracteres." })
                 .regex(/^(?:\d{10}|\d{13})$/, { message: "ISBN inválido. Deve conter 10 ou 13 dígitos."}),
  quantity: z.coerce.number().int().positive({ message: "Quantidade deve ser um número positivo." }),
});

type AddBookFormValues = z.infer<typeof addBookSchema>;

export function AddBookForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddBookFormValues>({
    resolver: zodResolver(addBookSchema),
    defaultValues: {
      isbn: '',
      quantity: 1,
    },
  });

  async function onSubmit(data: AddBookFormValues) {
    setIsLoading(true);
    try {
      const newBook = await adminAddBook(data.isbn, data.quantity);
      if (newBook) {
        toast({
          title: "Livro Adicionado!",
          description: `"${newBook.title}" foi adicionado/atualizado com sucesso com ${data.quantity} cópias.`,
        });
        form.reset();
      } else {
        toast({
          title: "Erro ao Adicionar Livro",
          description: "Não foi possível encontrar ou adicionar o livro. Verifique o ISBN ou tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to add book:", error);
      toast({
        title: "Erro Inesperado",
        description: "Ocorreu um erro ao adicionar o livro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Adicionar Novo Livro ao Acervo</CardTitle>
        <CardDescription>Insira o ISBN e a quantidade para adicionar um livro ao sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="isbn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ISBN (10 ou 13 dígitos)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 9780321765723" {...field} />
                  </FormControl>
                  <FormDescription>
                    O sistema buscará os detalhes do livro usando o ISBN fornecido.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 5" {...field} />
                  </FormControl>
                  <FormDescription>
                    Número total de cópias deste livro a serem adicionadas ao acervo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                "Adicionar Livro ao Acervo"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
