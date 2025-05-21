
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAllLoans, returnBook } from '@/services/loanService';
import type { Loan } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/ui/loader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, CheckCircle, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore'; // Added import

export function ManageLoans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLoans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allLoans = await getAllLoans();
      setLoans(allLoans);
    } catch (err) {
      console.error("Failed to fetch loans:", err);
      setError("Não foi possível carregar os empréstimos. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const handleReturnBook = async (loanId: string) => {
    if (!loanId) return;
    try {
      await returnBook(loanId);
      toast({
        title: "Livro Devolvido!",
        description: "O empréstimo foi marcado como devolvido com sucesso.",
      });
      fetchLoans(); // Refresh the list
    } catch (err) {
      console.error("Failed to return book:", err);
      toast({
        title: "Erro ao Devolver Livro",
        description: "Não foi possível marcar o empréstimo como devolvido. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader size={32} />
        <p className="mt-2 text-muted-foreground">Carregando empréstimos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-8">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Erro ao Carregar</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="text-center py-10">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum empréstimo encontrado no sistema.</p>
      </div>
    );
  }

  const formatDate = (timestamp: Timestamp | Date | undefined | null): string => {
    if (!timestamp) return 'N/A';
    // Check if it's a Firestore Timestamp and convert, otherwise assume it's already a Date
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    try {
        return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch (e) {
        console.error("Error formatting date:", e, "Timestamp:", timestamp)
        return "Data inválida"
    }
  };


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Gerenciar Empréstimos</h2>
      <div className="border rounded-lg shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título do Livro</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Email do Usuário</TableHead>
              <TableHead>Data do Empréstimo</TableHead>
              <TableHead>Data de Devolução (Prevista)</TableHead>
              <TableHead>Data de Devolução (Real)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell className="font-medium">{loan.bookTitle}</TableCell>
                <TableCell>{loan.userDisplayName || 'N/A'}</TableCell>
                <TableCell>{loan.userEmail || 'N/A'}</TableCell>
                <TableCell>{formatDate(loan.loanDate)}</TableCell>
                <TableCell>{formatDate(loan.dueDate)}</TableCell>
                <TableCell>{loan.returnDate ? formatDate(loan.returnDate) : 'Pendente'}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      loan.status === 'active'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {loan.status === 'active' ? 'Ativo' : 'Devolvido'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {loan.status === 'active' && loan.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReturnBook(loan.id!)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Marcar como Devolvido
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

