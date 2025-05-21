'use server';
/**
 * @fileOverview An AI agent to generate a book synopsis and analyze its genres.
 *
 * - generateBookSynopsis - A function that generates the book synopsis and analyzes its genres.
 * - GenerateBookSynopsisInput - The input type for the generateBookSynopsis function.
 * - GenerateBookSynopsisOutput - The return type for the generateBookSynopsis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBookSynopsisInputSchema = z.object({
  title: z.string().describe('The title of the book.'),
  author: z.string().describe('The author of the book.'),
  description: z.string().describe('The description of the book.'),
});
export type GenerateBookSynopsisInput = z.infer<typeof GenerateBookSynopsisInputSchema>;

const GenerateBookSynopsisOutputSchema = z.object({
  synopsis: z.string().describe('A concise synopsis of the book.'),
  genres: z.string().describe('A comma-separated list of genres that the book fits into.'),
});
export type GenerateBookSynopsisOutput = z.infer<typeof GenerateBookSynopsisOutputSchema>;

export async function generateBookSynopsis(input: GenerateBookSynopsisInput): Promise<GenerateBookSynopsisOutput> {
  return generateBookSynopsisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBookSynopsisPrompt',
  input: {schema: GenerateBookSynopsisInputSchema},
  output: {schema: GenerateBookSynopsisOutputSchema},
  prompt: `You are a literary expert. Generate a concise synopsis of the book and identify its genres.

Title: {{{title}}}
Author: {{{author}}}
Description: {{{description}}}

Synopsis:
Genres (comma-separated):`,
});

const generateBookSynopsisFlow = ai.defineFlow(
  {
    name: 'generateBookSynopsisFlow',
    inputSchema: GenerateBookSynopsisInputSchema,
    outputSchema: GenerateBookSynopsisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
