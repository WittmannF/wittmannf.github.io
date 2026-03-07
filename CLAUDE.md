# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:4321 (or 4322 if busy)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Architecture

**Astro 5** static site — personal blog + portfolio for Fernando Wittmann. Tailwind CSS v4 runs as a Vite plugin (no `tailwind.config.js` needed). Syntax highlighting uses Shiki with `tokyo-night` theme.

### Routing / i18n

- English (default): `/`, `/blog`, `/projects`
- Portuguese: `/pt/`, `/pt/blog`, `/projetos`

No Astro i18n config is used — routing is manual. Each page passes `lang` and `alternateUrl` props to `BaseLayout`, which forwards them to the Header (language switcher) and Footer.

### Content Collections (`src/content/config.ts`)

- **`blog`**: Markdown posts with `title`, `description`, `pubDate`, `tags`, `draft` (default `false`), `lang` (`'en'` | `'pt'`, default `'en'`). Set `draft: true` to hide a post.
- **`projects`**: `title`, `description`, `tech[]`, `github?`, `demo?`, `featured`, `order`.

Blog listing pages filter by `post.data.lang === 'en'` (EN) or `=== 'pt'` (PT). Draft posts are excluded by `!post.data.draft`.

### Key files

| File | Purpose |
|---|---|
| `src/styles/global.css` | CSS custom properties (`--tn-*`, `--accent`), component classes |
| `src/i18n/ui.ts` | EN/PT translation strings + `useTranslations(lang)` helper |
| `src/layouts/BaseLayout.astro` | Root layout; accepts `lang`, `alternateUrl`, includes Google Fonts |
| `src/layouts/BlogPost.astro` | Blog post layout with prose styling |
| `src/components/Header.astro` | Sticky header, nav links vary by `lang`, language switcher |
| `src/components/Footer.astro` | Social links (GitHub, LinkedIn) |
| `astro.config.mjs` | Integrations (mdx, sitemap), Shiki theme, site URL |

### Theme

AstroPaper-inspired dark mode. Background `#0d1117`, single accent `#89b4fa` (soft blue). Defined as CSS custom properties in `global.css`. Tokyo Night used only for code syntax highlighting via Shiki.

Fonts: **Inter** (body) + **Space Grotesk** (headings) loaded from Google Fonts in `BaseLayout.astro`.

### Static assets

Blog post images go in `public/blog/<post-slug>/` and are referenced as `/blog/<post-slug>/image.png` in Markdown.

### Deploy

GitHub Actions workflows exist for Cloudflare Pages, GitHub Pages, and Vercel. Site URL: `https://fernandowittmann.com`.
