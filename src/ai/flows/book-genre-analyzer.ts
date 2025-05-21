'use server';
/**
 * @fileOverview An AI agent that suggests potential genres for a book.
 *
 * - analyzeBookGenre - A function that analyzes a book and suggests genres.
 * - AnalyzeBookGenreInput - The input type for the analyzeBookGenre function.
 * - AnalyzeBookGenreOutput - The return type for the analyzeBookGenre function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeBookGenreInputSchema = z.object({
  bookTitle: z.string().describe('The title of the book.'),
  bookSynopsis: z.string().describe('A brief synopsis of the book.'),
});
export type AnalyzeBookGenreInput = z.infer<typeof AnalyzeBookGenreInputSchema>;

const AnalyzeBookGenreOutputSchema = z.object({
  genres: z.array(z.string()).describe('An array of suggested genres for the book.'),
});
export type AnalyzeBookGenreOutput = z.infer<typeof AnalyzeBookGenreOutputSchema>;

export async function analyzeBookGenre(input: AnalyzeBookGenreInput): Promise<AnalyzeBookGenreOutput> {
  return analyzeBookGenreFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeBookGenrePrompt',
  input: {schema: AnalyzeBookGenreInputSchema},
  output: {schema: AnalyzeBookGenreOutputSchema},
  prompt: `You are an expert in book genres.

  Given the title and synopsis of a book, suggest up to 5 relevant genres.

  Title: {{{bookTitle}}}
  Synopsis: {{{bookSynopsis}}}

  Genres:`,
});

const analyzeBookGenreFlow = ai.defineFlow(
  {
    name: 'analyzeBookGenreFlow',
    inputSchema: AnalyzeBookGenreInputSchema,
    outputSchema: AnalyzeBookGenreOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
