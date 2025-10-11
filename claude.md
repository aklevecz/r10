# R10 RSVP App

A simple RSVP application built with Svelte 5 and Tailwind CSS.

## Tech Stack

- **Framework**: Svelte 5 (using modern runes and new syntax)
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite
- **Type Safety**: TypeScript
- **Routing**: SvelteKit

## Project Guidelines

### Svelte 5 Best Practices

- Use Svelte 5 runes syntax exclusively:
  - `$state()` for reactive state
  - `$derived()` for computed values
  - `$effect()` for side effects
  - `$props()` for component props
- Avoid legacy Svelte syntax (no `let`, `$:`, or `export let`)
- Use snippets instead of slots where appropriate
- Leverage fine-grained reactivity

### Styling Guidelines

- **Tailwind CSS only** - no custom CSS files or inline styles outside of Tailwind utilities
- Use Tailwind's utility classes for all styling
- Follow mobile-first responsive design approach
- Leverage Tailwind's design system for consistency

### Code Style

- TypeScript for type safety
- Prettier for code formatting (configured with Svelte and Tailwind plugins)
- Follow functional and declarative programming patterns

## Project Structure

```
r10/
├── src/
│   ├── routes/          # SvelteKit file-based routing
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   └── lib/             # Reusable components and utilities
├── static/              # Static assets
└── package.json
```

## RSVP App Features

This is a simple RSVP application for managing event responses. Core functionality includes:

- Guest RSVP form
- Response tracking (attending/not attending)
- Guest list management
- Event details display

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Format code
npm run format

# Lint code
npm run lint
```

## Dependencies

- `svelte`: ^5.39.5
- `@sveltejs/kit`: ^2.43.2
- `tailwindcss`: ^4.1.13
- `@tailwindcss/vite`: ^4.1.13
- `typescript`: ^5.9.2
- `vite`: ^7.1.7

## Notes

- No component libraries - build UI with vanilla Svelte 5 + Tailwind
- Keep components simple and composable
- Prioritize user experience and accessibility
