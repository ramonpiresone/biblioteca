
import type { Book, OpenLibrarySearchResponse, OpenLibraryBookData, OpenLibraryBookDetails } from '@/types';

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_COVERS_URL = 'https://covers.openlibrary.org';
const OPEN_LIBRARY_BOOKS_API_URL = 'https://openlibrary.org/api/books';

function getCoverUrls(item: { cover_i?: number, isbn?: string[] }): { small?: string, medium?: string, large?: string } {
  if (item.isbn && item.isbn.length > 0) {
    const firstIsbn = item.isbn[0];
    return {
      small: `${OPEN_LIBRARY_COVERS_URL}/b/isbn/${firstIsbn}-S.jpg`,
      medium: `${OPEN_LIBRARY_COVERS_URL}/b/isbn/${firstIsbn}-M.jpg`,
      large: `${OPEN_LIBRARY_COVERS_URL}/b/isbn/${firstIsbn}-L.jpg`,
    };
  } else if (item.cover_i) {
    return {
      small: `${OPEN_LIBRARY_COVERS_URL}/b/id/${item.cover_i}-S.jpg`,
      medium: `${OPEN_LIBRARY_COVERS_URL}/b/id/${item.cover_i}-M.jpg`,
      large: `${OPEN_LIBRARY_COVERS_URL}/b/id/${item.cover_i}-L.jpg`,
    };
  }
  return {};
}

export async function searchBooks(query: string, limit: number = 20, signal?: AbortSignal): Promise<Book[]> {
  if (!query.trim()) {
    return [];
  }
  const params = new URLSearchParams({
    q: query,
    fields: 'key,title,author_name,first_publish_year,isbn,cover_i,olid',
    limit: limit.toString(),
  });

  try {
    const response = await fetch(`${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`, { signal });
    if (!response.ok) {
      console.error('Open Library API search error:', response.status, await response.text());
      return [];
    }
    const data: OpenLibrarySearchResponse = await response.json();
    
    return data.docs.map((doc): Book => {
      const covers = getCoverUrls(doc);
      const olid = doc.olid && doc.olid.length > 0 ? doc.olid[0] : undefined;
      return {
        key: doc.key,
        title: doc.title,
        author_name: doc.author_name,
        first_publish_year: doc.first_publish_year,
        isbn: doc.isbn,
        cover_i: doc.cover_i,
        olid: olid,
        cover_url_small: covers.small,
        cover_url_medium: covers.medium,
        cover_url_large: covers.large,
      };
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Busca de livros abortada.');
      return []; 
    }
    console.error('Falha ao buscar livros da Open Library:', error);
    return [];
  }
}

export async function getBookDetailsByISBN(isbn: string, signal?: AbortSignal): Promise<OpenLibraryBookDetails | null> {
  if (!isbn.trim()) {
    return null;
  }
  const params = new URLSearchParams({
    bibkeys: `ISBN:${isbn}`,
    format: 'json',
    jscmd: 'data',
  });

  try {
    const response = await fetch(`${OPEN_LIBRARY_BOOKS_API_URL}?${params.toString()}`, { signal });
    if (!response.ok) {
      console.error('Open Library Books API error:', response.status, await response.text());
      return null;
    }
    const data: OpenLibraryBookData = await response.json();
    const bookKey = `ISBN:${isbn}`;
    // The API returns an object where the key is `ISBN:${isbn}`
    // and the value is the book details.
    return data[bookKey] || null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Busca de detalhes do livro abortada.');
      return null;
    }
    console.error('Falha ao buscar detalhes do livro da Open Library:', error);
    return null;
  }
}
