
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Loader } from '@/components/ui/loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddBookForm } from './add-book-form';
// Placeholder for ManageLoans component, to be created later
// import { ManageLoans } from './manage-loans'; 
import { ShieldAlert } from 'lucide-react';

export default function AdminPage() {
  const { firestoreUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !firestoreUser?.roles?.admin) {
      router.replace('/'); // Redirect non-admins to home
    }
  }, [firestoreUser, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-15rem)]">
        <Loader size={48} />
        <p className="mt-4 text-muted-foreground">Verificando permissões...</p>
      </div>
    );
  }

  if (!firestoreUser?.roles?.admin) {
    // This state should ideally be brief due to the useEffect redirect,
    // but it's a fallback.
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-15rem)] text-center">
        <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        <p className="text-muted-foreground mt-1">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-primary">Painel de Gerenciamento</h1>
      <Tabs defaultValue="add-books" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="add-books">Adicionar Livros</TabsTrigger>
          <TabsTrigger value="manage-loans" disabled>Gerenciar Empréstimos (Em Breve)</TabsTrigger>
        </TabsList>
        <TabsContent value="add-books" className="mt-6">
          <AddBookForm />
        </TabsContent>
        <TabsContent value="manage-loans" className="mt-6">
          <div className="p-6 bg-card rounded-lg shadow border">
             <h2 className="text-xl font-semibold mb-4">Gerenciar Empréstimos</h2>
             <p className="text-muted-foreground">Esta funcionalidade estará disponível em breve.</p>
          </div>
          {/* <ManageLoans />  Placeholder for when the component is ready */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
