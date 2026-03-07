# Guia de Setup e Deploy

## 1. Personalizar o Site

### Informações Pessoais

Edite estes arquivos para personalizar com suas informações:

**src/components/Header.astro** (linha 13):
```astro
Seu Nome
```

**src/components/Footer.astro** (linhas 10-15):
```astro
© {currentYear} Seu Nome
```

**src/components/Footer.astro** (linhas 18-37):
- Atualize os links do GitHub, LinkedIn e Twitter

**src/pages/index.astro** (linhas 18-20):
```astro
Olá, sou <span class="text-indigo-600">Seu Nome</span>
```

**astro.config.mjs** (linha 5):
```js
site: 'https://seudominio.com',
```

## 2. Testar Localmente

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Abrir no navegador: http://localhost:4321
```

## 3. Opções de Deploy

### Opção A: Cloudflare Pages (Recomendado)

#### Via Dashboard (Mais Fácil):
1. Acesse https://pages.cloudflare.com/
2. Clique em "Create a project"
3. Conecte seu repositório GitHub
4. Configure:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node version**: `20`
5. Clique em "Save and Deploy"

#### Via GitHub Actions (Automático):
1. Obtenha suas credenciais Cloudflare:
   - Account ID: Dashboard > Pages > Account ID
   - API Token: https://dash.cloudflare.com/profile/api-tokens
     - Criar token com permissão "Cloudflare Pages - Edit"

2. Adicione as secrets no GitHub:
   - Vá em: Repositório > Settings > Secrets and variables > Actions
   - Adicione:
     - `CLOUDFLARE_ACCOUNT_ID`: seu account ID
     - `CLOUDFLARE_API_TOKEN`: seu API token

3. Edite `.github/workflows/deploy-cloudflare.yml` (linha 35):
   ```yaml
   command: pages deploy dist --project-name=seu-projeto-nome
   ```

4. Push para `main` e o deploy será automático!

### Opção B: Vercel

#### Via Dashboard (Mais Fácil):
1. Acesse https://vercel.com
2. Clique em "Add New Project"
3. Importe seu repositório GitHub
4. Vercel detectará Astro automaticamente
5. Clique em "Deploy"

#### Via CLI:
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy para produção
vercel --prod
```

### Opção C: GitHub Pages

1. Vá em: Repositório > Settings > Pages
2. Em "Source", selecione "GitHub Actions"
3. Delete `.github/workflows/deploy-cloudflare.yml` (ou desabilite)
4. Push para `main`
5. O workflow `deploy-github-pages.yml` fará o deploy

**Importante**: Se usar GitHub Pages, atualize `astro.config.mjs`:
```js
export default defineConfig({
  site: 'https://seu-usuario.github.io',
  base: '/nome-do-repositorio', // apenas se não for username.github.io
  // ...
});
```

## 4. Domínio Customizado

### Cloudflare Pages:
1. Dashboard > Pages > seu projeto > Custom domains
2. Adicione seu domínio
3. Configure o DNS conforme instruções

### Vercel:
1. Dashboard > seu projeto > Settings > Domains
2. Adicione seu domínio
3. Configure o DNS (geralmente um CNAME para `cname.vercel-dns.com`)

### GitHub Pages:
1. Settings > Pages > Custom domain
2. Digite seu domínio
3. Configure o DNS:
   - Adicione um arquivo `public/CNAME` com seu domínio
   - Configure DNS A records apontando para GitHub IPs

## 5. Adicionar Conteúdo

### Novo Post:

Crie `src/content/blog/nome-do-post.md`:

```markdown
---
title: 'Título do Post'
description: 'Breve descrição'
pubDate: 2024-03-06
tags: ['javascript', 'web']
draft: false
---

Conteúdo aqui...
```

### Novo Projeto:

Crie `src/content/projects/nome-projeto.md`:

```markdown
---
title: 'Nome do Projeto'
description: 'O que ele faz'
tech: ['React', 'Node.js', 'PostgreSQL']
github: 'https://github.com/usuario/repo'
demo: 'https://demo.com'
featured: true
order: 1
---

Detalhes do projeto...
```

## 6. Dicas Adicionais

### Adicionar Google Analytics:

Em `src/layouts/BaseLayout.astro`, adicione no `<head>`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Implementar Dark Mode:

Use classes do Tailwind (`dark:`) que já estão no código! Adicione um botão toggle e salve preferência no localStorage.

### RSS Feed:

O feed RSS é gerado automaticamente. Acesse em: `/rss.xml`

### SEO:

Edite as meta tags em `src/layouts/BaseLayout.astro` para cada página.

## 7. Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Preview do build
npm run preview

# Desabilitar telemetria do Astro (opcional)
npx astro telemetry disable
```

## 8. Estrutura Recomendada de Git

```bash
# Inicializar repositório (se ainda não tiver)
git init

# Adicionar tudo
git add .

# Primeiro commit
git commit -m "Initial commit: Astro blog + portfolio"

# Criar repositório no GitHub e conectar
git remote add origin https://github.com/seu-usuario/seu-repo.git
git branch -M main
git push -u origin main
```

## 9. Próximos Passos

- [ ] Personalizar cores e tema
- [ ] Adicionar suas informações pessoais
- [ ] Criar alguns posts e projetos
- [ ] Configurar domínio customizado (opcional)
- [ ] Adicionar analytics (opcional)
- [ ] Implementar comentários (Giscus, Utterances)
- [ ] Adicionar modo escuro completo

## Recursos Úteis

- [Documentação Astro](https://docs.astro.build)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [MDX Documentation](https://mdxjs.com/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Vercel Docs](https://vercel.com/docs)

## Suporte

Se precisar de ajuda, consulte:
- Documentação oficial do Astro
- Discord do Astro: https://astro.build/chat
- Stack Overflow com tag `astro`

Boa sorte com seu blog! 🚀
