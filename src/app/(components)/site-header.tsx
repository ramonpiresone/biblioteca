
"use client";

import Link from 'next/link';
import { BookOpen, Home, Heart } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/favorites', label: 'Favoritos', icon: Heart },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold hover:text-accent transition-colors">
          <BookOpen size={28} />
          <span>BiblioTech Lite</span>
        </Link>
        <nav>
          <ul className="flex items-center gap-4 sm:gap-6">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 text-sm sm:text-base hover:text-accent transition-colors",
                    pathname === item.href ? "text-accent font-semibold" : ""
                  )}
                >
                  <item.icon size={20} className="hidden sm:block" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
