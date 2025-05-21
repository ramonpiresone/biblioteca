
"use client";

import type { Book } from '@/types';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FavoritesToggleButton } from './favorites-toggle-button';

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const authorText = book.author_name?.join(', ') || 'Unknown Author';
  const publishYearText = book.first_publish_year ? `First published: ${book.first_publish_year}` : '';

  const coverUrl = book.cover_url_medium || book.cover_url_small || `https://placehold.co/300x450.png?text=${encodeURIComponent(book.title)}`;
  const placeholderHint = !book.cover_url_medium && !book.cover_url_small ? "book cover" : undefined;

  return (
    <>
      <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden">
        <CardHeader className="p-4">
          <CardTitle className="text-lg font-semibold leading-tight truncate" title={book.title}>
            {book.title}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground truncate" title={authorText}>
            {authorText}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex-grow flex flex-col items-center">
          <div className="relative w-full aspect-[2/3] mb-4 rounded overflow-hidden bg-muted">
            <Image
              src={coverUrl}
              alt={`Cover of ${book.title}`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              style={{ objectFit: 'cover' }}
              priority={false} // Only a few cards above the fold should be priority
              data-ai-hint={placeholderHint}
              unoptimized={coverUrl.startsWith('https://covers.openlibrary.org')} // openlibrary covers are already optimized
            />
          </div>
          {publishYearText && <p className="text-xs text-muted-foreground self-start">{publishYearText}</p>}
        </CardContent>
        <CardFooter className="p-4 flex justify-end items-center border-t">
          <FavoritesToggleButton book={book} />
        </CardFooter>
      </Card>
    </>
  );
}
