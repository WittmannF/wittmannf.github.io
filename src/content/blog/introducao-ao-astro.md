---
title: 'Introdução ao Astro'
description: 'Descubra por que Astro é uma excelente escolha para criar sites modernos e performáticos'
pubDate: 2024-03-07
tags: ['astro', 'web development', 'javascript']
lang: 'pt'
draft: true
---

# Por que Astro?

Astro é um framework moderno para construção de sites focado em performance. Ele oferece uma abordagem única chamada "Islands Architecture".

## Principais características

### 1. Zero JavaScript por padrão

Astro envia HTML puro para o navegador, carregando JavaScript apenas quando necessário.

```astro
---
// Este código roda no servidor
const data = await fetch('https://api.example.com/data');
---

<div>{data.title}</div>
```

### 2. Traz seu próprio framework

Você pode usar React, Vue, Svelte ou qualquer outro framework, tudo no mesmo projeto:

```astro
---
import ReactComponent from './ReactComponent.jsx';
import VueComponent from './VueComponent.vue';
---

<ReactComponent />
<VueComponent />
```

### 3. Performance excepcional

Sites em Astro são extremamente rápidos por padrão, com otimizações automáticas.

## Conclusão

Astro é perfeito para blogs, sites de documentação, landing pages e portfólios.
