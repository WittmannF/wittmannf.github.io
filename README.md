# Blog Pessoal + Portfólio

Blog pessoal e portfólio construído com Astro, Tailwind CSS e hospedado no Cloudflare Pages/Vercel.

## Tecnologias

- **Astro 5** - Framework moderno focado em performance
- **Tailwind CSS** - Utility-first CSS framework
- **MDX** - Markdown com componentes interativos
- **TypeScript** - Type safety

## Estrutura do Projeto

```
/
├── public/              # Assets estáticos
├── src/
│   ├── content/         # Conteúdo (blog posts e projetos)
│   │   ├── blog/        # Posts do blog em Markdown/MDX
│   │   └── projects/    # Projetos do portfólio
│   ├── components/      # Componentes reutilizáveis
│   ├── layouts/         # Layouts de páginas
│   ├── pages/           # Páginas do site
│   └── styles/          # Estilos globais
├── astro.config.mjs     # Configuração do Astro
└── package.json
```

## Começando

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

O site estará disponível em `http://localhost:4321`

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Adicionar Conteúdo

### Novo Post

Crie um arquivo `.md` ou `.mdx` em `src/content/blog/`:

```markdown
---
title: 'Título do Post'
description: 'Descrição breve'
pubDate: 2024-03-06
tags: ['tag1', 'tag2']
draft: false
---

Conteúdo do post aqui...
```

### Novo Projeto

Crie um arquivo `.md` em `src/content/projects/`:

```markdown
---
title: 'Nome do Projeto'
description: 'Descrição do projeto'
tech: ['React', 'Node.js']
github: 'https://github.com/usuario/repo'
demo: 'https://demo.com'
featured: true
order: 1
---

Detalhes do projeto...
```

## Deploy

### Cloudflare Pages

1. Conecte seu repositório no dashboard do Cloudflare Pages
2. Configure as variáveis no GitHub:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Push para `main` e o deploy será automático

**OU** use o workflow manual:

```bash
# Instale wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
npm run build
wrangler pages deploy dist --project-name=seu-projeto
```

### Vercel

1. Instale o Vercel CLI: `npm i -g vercel`
2. Execute `vercel` na raiz do projeto
3. Ou conecte o repositório no dashboard do Vercel

### GitHub Pages

1. Vá em Settings > Pages no seu repositório
2. Selecione "GitHub Actions" como source
3. Push para `main` e o workflow fará o deploy

## Personalização

### Informações Pessoais

Edite os seguintes arquivos:

- `src/components/Header.astro` - Nome no header
- `src/components/Footer.astro` - Links sociais
- `src/pages/index.astro` - Descrição da home
- `astro.config.mjs` - URL do site

### Cores e Tema

Edite `src/styles/global.css` para personalizar as cores:

```css
:root {
  --color-primary: 99 102 241;  /* Indigo */
  --color-secondary: 139 92 246; /* Purple */
}
```

### Domínio Customizado

Para usar seu próprio domínio:

1. Configure o DNS do seu domínio
2. Adicione o domínio no dashboard do host (Cloudflare/Vercel)
3. Atualize `site` em `astro.config.mjs`

## Features

- Design responsivo
- Modo escuro (pronto para implementar)
- Syntax highlighting para code blocks
- RSS feed automático
- Sitemap para SEO
- Performance otimizada
- Deploy automático via GitHub Actions

## Licença

MIT
