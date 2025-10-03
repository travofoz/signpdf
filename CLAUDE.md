# Project Instructions

## CRITICAL - DO NOT MODIFY

**NEVER remove or modify `allowedHosts: ['signpdf.leadplateau.com']` from vite.config.ts**

This configuration is required for the reverse proxy setup to work correctly with the domain name.

## Production Setup

- Adapter: `@sveltejs/adapter-node`
- Port: 4567
- PM2 config: `ecosystem.config.cjs`
- Environment variables in `.env` for reverse proxy headers

## Nginx Configuration

- WebSocket support via `$connection_upgrade` map in `/etc/nginx/nginx.conf`
- Reverse proxy headers: `X-Forwarded-Proto`, `X-Forwarded-Host`, `Host`
