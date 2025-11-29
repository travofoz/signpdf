# Signatura

A modern PDF signing application built with Svelte 5, TypeScript, and Tailwind CSS. Signatura allows you to upload PDF documents, add signatures (drawn or uploaded), position them precisely on pages, and download the signed documents.

## Features

- 📄 Upload PDF documents
- ✍️ Draw signatures or upload signature images
- 🎯 Drag and resize signatures on PDF pages
- 📱 Responsive design with touch support
- ⚡ Works entirely client-side
- 🚀 Static deployment ready

## Development

Once you've cloned the repository and installed dependencies with `npm install`, start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

The development server runs on http://localhost:4567

## Building

To create a production version of the app:

```sh
npm run build
```

You can preview the production build with:

```sh
npm run preview
```

## Deployment

This application is configured for static deployment to GitHub Pages using `@sveltejs/adapter-static`. The GitHub Actions workflow in `.github/workflows/deploy.yml` automatically deploys to GitHub Pages when pushing to the main branch.

## Tech Stack

- **Framework**: Svelte 5 with TypeScript
- **Styling**: Tailwind CSS with DaisyUI components
- **PDF Handling**: pdf-lib for manipulation, pdfjs-dist for rendering
- **Build**: Vite with SvelteKit
- **Deployment**: Static files for GitHub Pages