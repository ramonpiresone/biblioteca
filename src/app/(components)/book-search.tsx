
"use client";

import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface BookSearchProps {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  placeholder?: string;
}

export function BookSearch({ query, setQuery, placeholder = "Search books by title, author, or ISBN..." }: BookSearchProps) {
  return (
    <div className="relative mb-8">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-4 py-2 w-full text-base rounded-md shadow-sm"
        aria-label="Search books"
      />
    </div>
  );
}
