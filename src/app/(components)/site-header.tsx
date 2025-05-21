
"use client";

import Link from 'next/link';
import { BookOpen, Home, Heart, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const pathname = usePathname();
  const { user, signOutUser, loading } = useAuth();

  const navItems = [
    { href: '/', label: 'Início', icon: Home, requiresAuth: false },
    { href: '/favorites', label: 'Favoritos', icon: Heart, requiresAuth: true },
  ];

  const visibleNavItems = navItems.filter(item => !item.requiresAuth || (item.requiresAuth && user));

  const getUserInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length > 1) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="bg-card text-card-foreground shadow-md border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary hover:opacity-80 transition-opacity">
          <BookOpen size={28} />
          <span>Projeto Biblioteca</span>
        </Link>
        <div className="flex items-center gap-4">
          <nav>
            <ul className="flex items-center gap-3 sm:gap-5">
              {visibleNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 text-sm sm:text-base hover:text-primary transition-colors",
                      pathname === item.href ? "text-primary font-semibold" : "text-muted-foreground"
                    )}
                  >
                    <item.icon size={18} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {loading ? (
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-1 rounded-full h-auto focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0">
                  {user.displayName && (
                    <span className="text-sm font-medium hidden sm:inline-block text-card-foreground">
                      {user.displayName.split(' ')[0]} {/* Mostra apenas o primeiro nome */}
                    </span>
                  )}
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "Avatar do usuário"} />
                    <AvatarFallback>{getUserInitials(user.displayName, user.email)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName || "Usuário"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOutUser} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
             pathname !== '/login' && (
                <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-2")}>
                    Entrar
                </Link>
             )
          )}
        </div>
      </div>
    </header>
  );
}
