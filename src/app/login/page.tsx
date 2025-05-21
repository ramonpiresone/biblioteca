
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { BookOpen } from 'lucide-react';

// Google Icon SVG
const GoogleIcon = () => (
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="mr-2 h-5 w-5">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);

export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // This effect is for redirecting if user is already logged in when page loads
    // AppInitializer will also handle this, but this provides an immediate client-side check.
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // AppInitializer handles the primary loading and redirect logic before this page fully mounts.
  // So, if we reach here and still loading or user exists, it's a transient state.
  if (loading || (!loading && user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-15rem)]"> {/* Adjusted height */}
        <Loader size={48} />
        <p className="mt-4 text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-15rem)] px-4"> {/* Adjusted height and padding */}
      <div className="p-8 bg-card shadow-xl rounded-lg w-full max-w-md text-center border">
        <div className="flex justify-center items-center mb-6 text-primary">
          <BookOpen size={40} className="mr-2"/>
          <h1 className="text-3xl font-bold">BiblioTech Lite</h1>
        </div>
        <p className="mb-8 text-muted-foreground">
          Faça login com sua conta Google para explorar a biblioteca.
        </p>
        <Button
          onClick={signInWithGoogle}
          className="w-full text-base py-3"
          size="lg"
          variant="outline"
        >
          <GoogleIcon />
          Entrar com Google
        </Button>
         <p className="text-xs text-muted-foreground mt-6">
          Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade (fictícios).
        </p>
      </div>
    </div>
  );
}
