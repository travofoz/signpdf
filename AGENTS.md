# Agent Guidelines

## Commands
- **Build**: `npm run build` - Build for production
- **Dev**: `npm run dev` - Start development server on port 4567
- **Check**: `npm run check` - Run TypeScript and Svelte checks
- **Check watch**: `npm run check:watch` - Run checks in watch mode
- **Preview**: `npm run preview` - Preview production build
- **Start**: `npm run start` - Start production server

## Code Style
- **Framework**: Svelte 5 with TypeScript, use `$state()` for reactivity
- **Styling**: Tailwind CSS with DaisyUI components
- **Imports**: Use ES6 imports, place Svelte imports first
- **Types**: Strict TypeScript enabled, use proper typing throughout
- **Components**: Use `<script lang="ts">` blocks, follow Svelte 5 syntax
- **Error handling**: Use try-catch for async operations, validate inputs
- **Naming**: camelCase for variables, PascalCase for components
- **PDF libraries**: Use pdf-lib for PDF manipulation, pdfjs-dist for rendering

## Critical Configuration
- NEVER modify `allowedHosts: ['signatura.plugpuppy.com']` in vite.config.ts
- Adapter: @sveltejs/adapter-node with output directory 'build'
- Server runs on port 4567 with HMR WebSocket support