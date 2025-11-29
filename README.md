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

### GitHub Pages Configuration

**CRITICAL**: GitHub Pages must be configured to use "GitHub Actions" as the source, NOT "Deploy from a branch".

#### Setup Steps:
1. Go to repository Settings → Pages
2. Under "Build and deployment" → "Source", select **"GitHub Actions"**
3. Push changes to trigger the workflow

#### Why This Matters:
- **"Deploy from a branch"**: GitHub Pages processes source files with Jekyll (serves README.md)
- **"GitHub Actions"**: GitHub Pages serves artifacts uploaded by workflow (serves built app)

#### Required Files:
- `.nojekyll` - Disables Jekyll processing
- `CNAME` - Custom domain configuration (copied to build directory)
- `svelte.config.js` - Base path set to `''` for custom domains

#### Workflow Process:
1. GitHub Actions builds the app (`npm run build`)
2. Uploads `./build` directory as artifact
3. GitHub Pages serves the artifact content

The GitHub Actions workflow in `.github/workflows/deploy.yml` handles the build and deployment automatically when pushing to the master branch.

## Tech Stack

- **Framework**: Svelte 5 with TypeScript
- **Styling**: Tailwind CSS with DaisyUI components
- **PDF Handling**: pdf-lib for manipulation, pdfjs-dist for rendering
- **Build**: Vite with SvelteKit
- **Deployment**: Static files for GitHub Pages