# **App Name**: BiblioTech Lite

## Core Features:

- Book Catalog: Display a searchable list of books using data from the Open Library API and cover images from the Open Library Covers API, utilizing URLs like 'https://covers.openlibrary.org/b/isbn/${book.isbn}-S.jpg' and 'https://openlibrary.org/api/books?bibkeys=ISBN%3A${isbn}&format=json&jscmd=data'.
- Realtime search: Add a simple form for searching the books with a debounce function to prevent too many calls to the api, to provide almost instant results to the user
- Favorites Manager: Implement a system to organize and show your favorite books that are displayed by the Book Catalog API, and mark them to differentiate from others.
- AI Synopsis & Genre Analyzer: Leverage a large language model tool to give an synopsis of any book in the library and also be able to provide you the different genres it may fit to.

## Style Guidelines:

- Primary color: Deep Indigo (#3F51B5) to evoke a sense of knowledge and trustworthiness, reminiscent of traditional libraries. 
- Background color: Light Gray (#F5F5F5) to provide a clean and non-distracting backdrop, ensuring readability and focus on the content.
- Accent color: Amber (#FFC107) to highlight key interactive elements and CTAs, creating a warm contrast against the indigo and gray tones.
- Use a modern, sans-serif font for headings to maintain a clean and contemporary feel.
- Use a clear, readable serif font for the body to improve readability and create a comfortable reading experience.
- Employ a grid-based layout for presenting book listings to ensure a structured and visually appealing arrangement.
- Utilize flat, minimalist icons for navigation and actions to offer clear visual cues without overwhelming the user interface.