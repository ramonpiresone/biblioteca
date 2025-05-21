
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/app/(components)/site-header';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { AppInitializer } from '@/components/app-initializer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'BiblioTech Lite',
  description: 'Um aplicativo moderno de gerenciamento de biblioteca.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}>
        <AuthProvider>
          <AppInitializer>
            <div className="flex flex-col min-h-screen">
              <SiteHeader />
              <main className="flex-grow container mx-auto px-4 py-8">
                {children}
              </main>
              <footer className="py-6 text-center text-sm text-muted-foreground border-t">
                © {new Date().getFullYear()} BiblioTech Lite. Todos os direitos reservados.
              </footer>
            </div>
            <Toaster />
          </AppInitializer>
        </AuthProvider>
      </body>
    </html>
  );
}
