---
title: 'How to Build a Personal Blog & Portfolio with Astro 5 + Tailwind CSS v4'
description: 'A step-by-step guide to building a fast, bilingual personal blog and portfolio site using Astro 5, Tailwind CSS v4, and Tokyo Night theme — exactly how this one was built.'
pubDate: 2026-03-06
tags: ['Astro', 'Tailwind CSS', 'Web Dev', 'Tutorial']
---

This post walks through how to build a personal blog and portfolio site exactly like this one — using **Astro 5**, **Tailwind CSS v4**, bilingual support (EN/PT), and a Tokyo Night dark theme.

The full source code is available at [github.com/WittmannF/wittmannf.github.io](https://github.com/WittmannF/wittmannf.github.io).

---

## The Stack

Before diving in, a quick overview of every tool you'll encounter:

**[Astro](https://astro.build/)** is a **web framework** — a set of conventions and tools that gives your project structure so you don't build everything from scratch. Astro's differentiator: it renders HTML at build time and ships *zero JavaScript* to the browser by default. That makes pages load very fast. It also supports React, Vue, Svelte, and others side by side if you ever need interactivity. Astro runs on top of **[Vite](https://vite.dev/)** — a modern **build tool** that compiles, bundles, and serves your files during development. Think of Vite as the engine under the hood.

**[Tailwind CSS](https://tailwindcss.com/)** is a *utility-first* **CSS framework**. Instead of writing custom class names in a separate stylesheet (`.card { padding: 1.5rem; }`), you style elements by composing small, single-purpose utility classes directly in your markup: `class="rounded-xl p-6 font-bold"`. v4 is a major rewrite: it ships as a **Vite plugin** and requires zero configuration files.

**i18n** stands for *internationalization* — there are 18 letters between the "i" and the "n", hence the shorthand. It means building a site that can serve content in multiple languages. A related term: **l10n** (*localization*) — the actual translation work. Each language variant is identified by a **locale** (a language + region code like `en-US` or `pt-BR`).

**[Shiki](https://shiki.style/)** is the **syntax highlighter** Astro uses for code blocks. It colorizes code using the same grammar files as VS Code, so snippets on this blog look exactly like in your editor. You can swap its theme — this site uses `tokyo-night`.

**[MDX](https://mdxjs.com/)** is Markdown extended with JSX. It lets you embed interactive components inside a `.md` post. We use plain Markdown here, but MDX is available if you need it.

---

## Prerequisites

- Node.js 18+
- Basic familiarity with HTML, CSS, and JavaScript

---

## 1. Create the Astro project

```bash
npm create astro@latest my-blog
cd my-blog
```

Choose the **minimal** starter template. When asked about TypeScript, select **strict**.

Then add the integrations we need:

```bash
npx astro add mdx sitemap
```

---

## 2. Install Tailwind CSS v4

Tailwind v4 ships as a Vite plugin — no `tailwind.config.js` needed.

```bash
npm install tailwindcss @tailwindcss/vite @tailwindcss/typography
```

In `astro.config.mjs`, register the plugin:

```js
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
```

In your CSS file (`src/styles/global.css`), replace everything with:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

That's it — no configuration file required.

---

## 3. Apply the Tokyo Night theme

Tokyo Night is a popular dark theme. Define its colors as CSS variables in `global.css`:

```css
@layer base {
  :root {
    --tn-bg: #1a1b2e;
    --tn-surface: #16213e;
    --tn-border: #2a2b4a;
    --tn-text: #a9b1d6;
    --tn-text-bright: #c0caf5;
    --tn-muted: #565f89;
    --tn-blue: #7aa2f7;
    --tn-cyan: #7dcfff;
  }

  body {
    background-color: var(--tn-bg);
    color: var(--tn-text);
    @apply antialiased min-h-screen;
  }
}
```

Then define reusable component classes using these variables:

```css
@layer components {
  .card {
    background-color: rgba(22, 33, 62, 0.7);
    border: 1px solid var(--tn-border);
    @apply rounded-xl p-6 transition-all duration-300;
  }

  .gradient-text {
    background: linear-gradient(135deg, var(--tn-blue), var(--tn-cyan));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}
```

---

## 4. Set up Content Collections

Content Collections give you type-safe access to your Markdown files. Create `src/content/config.ts`:

```ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tech: z.array(z.string()),
    github: z.string().optional(),
    demo: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(999),
  }),
});

export const collections = { blog, projects };
```

Write blog posts as `.md` files in `src/content/blog/`:

```md
---
title: 'My first post'
description: 'A quick intro'
pubDate: 2026-03-06
tags: ['meta']
---

Hello world!
```

---

## 5. Build the layouts

Create `src/layouts/BaseLayout.astro` as the shell for all pages — it holds the `<html>`, `<head>`, Header, and Footer.

Accept a `lang` prop so you can serve English and Portuguese pages from the same layout:

```astro
---
interface Props {
  title: string;
  lang?: 'en' | 'pt';
  alternateUrl?: string;
}
const { title, lang = 'en', alternateUrl } = Astro.props;
---
<html lang={lang === 'en' ? 'en' : 'pt-BR'}>
  <head>...</head>
  <body>
    <Header lang={lang} alternateUrl={alternateUrl} />
    <main class="container py-12"><slot /></main>
    <Footer lang={lang} />
  </body>
</html>
```

---

## 6. Add bilingual support (EN/PT)

The simplest i18n approach for a small site: keep English pages at the root (`/`, `/blog`, `/projects`) and Portuguese pages under `/pt/` (`/pt/`, `/pt/blog`, `/projetos`).

Create `src/i18n/ui.ts` with your translation strings:

```ts
export const ui = {
  en: { 'nav.home': 'Home', 'nav.blog': 'Blog', ... },
  pt: { 'nav.home': 'Início', 'nav.blog': 'Blog', ... },
} as const;
```

Add a language switcher to your Header component. Each page passes an `alternateUrl` prop pointing to its translation:

```astro
<!-- src/pages/index.astro -->
<BaseLayout lang="en" alternateUrl="/pt/">
  ...
</BaseLayout>

<!-- src/pages/pt/index.astro -->
<BaseLayout lang="pt" alternateUrl="/">
  ...
</BaseLayout>
```

---

## 7. Configure syntax highlighting

Astro uses Shiki for code blocks. In `astro.config.mjs`, set the theme to match your design:

```js
markdown: {
  shikiConfig: {
    theme: 'tokyo-night',
    wrap: true
  }
}
```

---

## 8. Deploy

```bash
npm run build
```

The output goes to `dist/`. Choose a platform below.

### Cloudflare Pages (recommended)

#### Via Dashboard

1. Go to `dash.cloudflare.com` → **Workers & Pages** → **Create** → **Pages** tab
2. Connect your GitHub repository
3. Under **Build settings**, select the **Astro** preset — it auto-fills:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Deploy command**: *(leave empty)*
4. Click **Save and Deploy** — every push to `main` triggers a deploy automatically

#### Via GitHub Actions

1. Copy your **Account ID** from the Cloudflare dashboard
2. Create an API Token at `dash.cloudflare.com/profile/api-tokens` with *Cloudflare Pages - Edit* permission
3. Add both secrets to GitHub: **Settings > Secrets and variables > Actions**
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
4. In `.github/workflows/deploy-cloudflare.yml`, update the project name:
   ```yaml
   command: pages deploy dist --project-name=your-project-name
   ```
5. Push to `main` — the workflow deploys automatically

### Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository — Vercel detects Astro automatically
3. Click **Deploy**

---

## Final project structure

```
src/
  content/
    blog/       ← your .md posts
    projects/   ← your .md project entries
  i18n/
    ui.ts       ← EN/PT translation strings
  layouts/
    BaseLayout.astro
    BlogPost.astro
  components/
    Header.astro
    Footer.astro
  pages/
    index.astro       ← EN home
    blog/index.astro  ← EN blog
    projects.astro    ← EN projects
    pt/
      index.astro        ← PT home
      blog/index.astro
      blog/[...slug].astro
      projects.astro     ← PT projects
  styles/
    global.css
```

---

The full source code for this site is at **[github.com/WittmannF/wittmannf.github.io](https://github.com/WittmannF/wittmannf.github.io)**. Feel free to fork it and adapt it for your own portfolio.
