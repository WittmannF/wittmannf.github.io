---
title: 'Como criar um Blog Pessoal e Portfólio com Astro 5 + Tailwind CSS v4'
description: 'Passo a passo para criar um blog pessoal e portfólio bilíngue usando Astro 5, Tailwind CSS v4 e o tema Tokyo Night — exatamente como este site foi feito.'
pubDate: 2026-03-06
tags: ['Astro', 'Tailwind CSS', 'Web Dev', 'Tutorial']
lang: 'pt'
---

Este post mostra como criar um blog pessoal e portfólio exatamente como este — usando **Astro 5**, **Tailwind CSS v4**, suporte bilíngue (EN/PT) e o tema dark Tokyo Night.

O código-fonte completo está disponível em [github.com/WittmannF/wittmannf.github.io](https://github.com/WittmannF/wittmannf.github.io).

---

## O Stack

Antes de começar, um resumo de cada ferramenta que você vai encontrar:

**[Astro](https://astro.build/)** é um **framework web** — um conjunto de convenções e ferramentas que dá estrutura ao seu projeto para você não ter que construir tudo do zero. O diferencial do Astro: ele gera HTML em tempo de build e envia *zero JavaScript* para o navegador por padrão, o que torna as páginas muito rápidas. Ele funciona em cima do **[Vite](https://vite.dev/)** — uma **ferramenta de build** moderna que compila, empacota e serve seus arquivos durante o desenvolvimento. Pense no Vite como o motor por baixo do capô.

**[Tailwind CSS](https://tailwindcss.com/)** é um framework CSS *utility-first* (utilitário primeiro). Em vez de escrever nomes de classes customizados em um arquivo de estilo separado (`.card { padding: 1.5rem; }`), você estiliza os elementos compondo pequenas classes utilitárias diretamente no seu HTML: `class="rounded-xl p-6 font-bold"`. A v4 é uma reescrita completa: ela funciona como um **plugin do Vite** e não precisa de nenhum arquivo de configuração.

**i18n** é abreviação de *internationalization* (internacionalização) — há 18 letras entre o "i" e o "n", daí o apelido. Significa construir um site que consegue servir conteúdo em vários idiomas. Um termo relacionado: **l10n** (*localization*/localização) — o trabalho de tradução em si. Cada variante de idioma é identificada por um **locale** (um código de língua + região, como `en-US` ou `pt-BR`).

**[Shiki](https://shiki.style/)** é o **syntax highlighter** (realçador de sintaxe) que o Astro usa nos blocos de código. Ele colore o código usando os mesmos arquivos de gramática do VS Code, então os trechos de código neste blog parecem exatamente com o seu editor. Você pode trocar o tema — este site usa `tokyo-night`.

**[MDX](https://mdxjs.com/)** é Markdown estendido com JSX. Permite embutir componentes interativos dentro de um post `.md`. Aqui usamos Markdown puro, mas o MDX está disponível se precisar.

---

## Pré-requisitos

- Node.js 18+
- Conhecimento básico de HTML, CSS e JavaScript

---

## 1. Criando o projeto Astro

```bash
npm create astro@latest meu-blog
cd meu-blog
```

Escolha o template **minimal**. Quando perguntado sobre TypeScript, selecione **strict**.

Depois, adicione as integrações necessárias:

```bash
npx astro add mdx sitemap
```

---

## 2. Instalando o Tailwind CSS v4

O Tailwind v4 funciona como plugin do Vite — sem `tailwind.config.js`.

```bash
npm install tailwindcss @tailwindcss/vite @tailwindcss/typography
```

Em `astro.config.mjs`, registre o plugin:

```js
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
```

No arquivo CSS (`src/styles/global.css`), substitua tudo por:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

Pronto — nenhum arquivo de configuração adicional necessário.

---

## 3. Aplicando o tema Tokyo Night

Tokyo Night é um tema dark muito popular entre devs. Defina as cores como variáveis CSS em `global.css`:

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

Depois defina classes de componentes reutilizáveis:

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

## 4. Configurando Content Collections

Content Collections dão acesso com tipos seguros aos seus arquivos Markdown. Crie `src/content/config.ts`:

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
    lang: z.enum(['en', 'pt']).default('en'),
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

Escreva os posts como arquivos `.md` em `src/content/blog/`:

```md
---
title: 'Meu primeiro post'
description: 'Uma introdução rápida'
pubDate: 2026-03-06
tags: ['meta']
lang: 'pt'
---

Olá, mundo!
```

---

## 5. Criando os layouts

Crie `src/layouts/BaseLayout.astro` como a estrutura base de todas as páginas — contém `<html>`, `<head>`, Header e Footer.

Aceite uma prop `lang` para servir páginas em inglês e português pelo mesmo layout:

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

## 6. Adicionando suporte bilíngue (EN/PT)

A abordagem mais simples: mantenha as páginas em inglês na raiz (`/`, `/blog`, `/projects`) e as páginas em português em `/pt/` (`/pt/`, `/pt/blog`, `/projetos`).

Crie `src/i18n/ui.ts` com as strings de tradução:

```ts
export const ui = {
  en: { 'nav.home': 'Home', 'nav.blog': 'Blog', ... },
  pt: { 'nav.home': 'Início', 'nav.blog': 'Blog', ... },
} as const;
```

Adicione um botão alternador de idioma no Header. Cada página passa a prop `alternateUrl` apontando para sua tradução:

```astro
<!-- src/pages/index.astro -->
<BaseLayout lang="en" alternateUrl="/pt/">...</BaseLayout>

<!-- src/pages/pt/index.astro -->
<BaseLayout lang="pt" alternateUrl="/">...</BaseLayout>
```

Para filtrar os posts por idioma nas listagens:

```ts
// Blog EN: mostra só posts com lang: 'en'
const posts = (await getCollection('blog'))
  .filter(p => !p.data.draft && p.data.lang === 'en');

// Blog PT: mostra só posts com lang: 'pt'
const posts = (await getCollection('blog'))
  .filter(p => !p.data.draft && p.data.lang === 'pt');
```

---

## 7. Configurando syntax highlighting

O Astro usa Shiki para blocos de código. Em `astro.config.mjs`, defina o tema para combinar com o design:

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

Antes de qualquer coisa, gere o build de produção:

```bash
npm run build
```

O output vai para `dist/`. A partir daqui, escolha uma das três opções abaixo.

---

### Opção A — Cloudflare Pages (recomendado)

#### Via Dashboard

1. Acesse [pages.cloudflare.com](https://pages.cloudflare.com/) e clique em **Create a project**
2. Conecte seu repositório GitHub
3. Configure o build:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node version**: `20`
4. Clique em **Save and Deploy** — a cada push em `main` um novo deploy é disparado automaticamente

#### Via GitHub Actions

Se preferir mais controle no CI, configure o workflow de deploy automático:

1. No dashboard Cloudflare, copie seu **Account ID** (Dashboard > Pages > Account ID)
2. Crie um API Token em `dash.cloudflare.com/profile/api-tokens` com permissão *Cloudflare Pages - Edit*
3. Adicione as duas secrets no GitHub: **Settings > Secrets and variables > Actions**
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
4. No arquivo `.github/workflows/deploy-cloudflare.yml`, atualize o nome do projeto:
   ```yaml
   command: pages deploy dist --project-name=seu-projeto-nome
   ```
5. Push para `main` — o deploy acontece automaticamente via GitHub Actions

#### Via CLI (Wrangler)

Para deploys manuais sem GitHub Actions:

```bash
# Instale o Wrangler globalmente
npm install -g wrangler

# Autentique com sua conta Cloudflare
wrangler login

# Build e deploy
npm run build
wrangler pages deploy dist --project-name=seu-projeto
```

---

### Opção B — Vercel

#### Via Dashboard

1. Acesse [vercel.com](https://vercel.com) e clique em **Add New Project**
2. Importe seu repositório GitHub — o Vercel detecta Astro automaticamente
3. Clique em **Deploy**

#### Via CLI

```bash
# Instale o Vercel CLI
npm i -g vercel

# Deploy de preview
vercel

# Deploy para produção
vercel --prod
```

---

### Opção C — GitHub Pages

1. No repositório, vá em **Settings > Pages**
2. Em **Source**, selecione **GitHub Actions**
3. Se o workflow `deploy-cloudflare.yml` existir, delete-o ou desabilite-o para evitar conflito
4. Push para `main` — o workflow `deploy-github-pages.yml` fará o deploy automaticamente

> **Atenção:** se o repositório não for `usuario.github.io`, adicione a opção `base` em `astro.config.mjs`:
> ```js
> export default defineConfig({
>   site: 'https://seu-usuario.github.io',
>   base: '/nome-do-repositorio',
>   // ...
> });
> ```

---

### Domínio customizado

Após o deploy, você pode conectar seu próprio domínio:

| Plataforma | Caminho |
|---|---|
| Cloudflare Pages | Dashboard > Pages > seu projeto > **Custom domains** |
| Vercel | Dashboard > seu projeto > **Settings > Domains** |
| GitHub Pages | Settings > Pages > **Custom domain** + arquivo `public/CNAME` com seu domínio |

---

## Estrutura final do projeto

```
src/
  content/
    blog/       ← seus posts .md
    projects/   ← seus projetos .md
  i18n/
    ui.ts       ← strings de tradução EN/PT
  layouts/
    BaseLayout.astro
    BlogPost.astro
  components/
    Header.astro
    Footer.astro
  pages/
    index.astro       ← home EN
    blog/index.astro  ← blog EN
    projects.astro    ← projetos EN
    pt/
      index.astro     ← home PT
      blog/index.astro
    projetos.astro    ← projetos PT
  styles/
    global.css
```

---

O código-fonte completo deste site está em **[github.com/WittmannF/wittmannf.github.io](https://github.com/WittmannF/wittmannf.github.io)**. Fique à vontade para fazer um fork e adaptar para o seu portfólio.
