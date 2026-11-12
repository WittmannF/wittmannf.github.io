---
title: 'Só 25 Minutos: Por Que Criei um Pomodoro com Lo-fi no Terminal (e o Que Diz a Ciência)'
description: 'Como uso o Pomodoro para começar tarefas difíceis, o que a pesquisa diz sobre música e pausas, e a ferramenta CLI em Python que desenvolvi ao longo dos anos.'
pubDate: 2026-11-12
tags: ['Python', 'Produtividade', 'Open Source', 'CLI', 'Música']
lang: 'pt'
---

Durante anos, mantive quase sempre a mesma aba aberta: resultados de busca no YouTube por “lofi pomodoro”.

Eu escolhia uma playlist, começava a trabalhar e deixava a música e o timer rodando. Com o tempo, cansei de ouvir as mesmas faixas. Queria escolher minhas músicas, controlar tudo pelo terminal e alternar automaticamente entre música de foco e sons ambientes para as pausas.

Foi assim que comecei a desenvolver o [Lo-fi Pomodoro](https://github.com/WittmannF/lofi-pomodoro), uma ferramenta de linha de comando em Python que combina um timer de foco com música local ou Spotify. Uso e aprimoro esse projeto há anos e recentemente decidi disponibilizá-lo como open source.

Mas a maior lição não foi sobre construir um player. Foi sobre **facilitar o início de uma tarefa sem deixar que o relógio determine rigidamente quando devo parar**.

## Primeiro: o que é a Técnica Pomodoro?

A [Técnica Pomodoro](https://www.pomodorotechnique.com/) foi criada por Francesco Cirillo. Seu ciclo mais conhecido é bem simples:

1. Escolha uma tarefa.
2. Trabalhe nela por **25 minutos**.
3. Faça uma **pausa de 5 minutos**.
4. Depois de quatro sessões de foco, faça uma pausa maior (geralmente de 15 a 30 minutos).

O método original é mais completo: inclui planejamento, registro de interrupções e revisão do esforço. Mas esses quatro passos já explicam o funcionamento básico do timer deste artigo.

Pessoalmente, não sigo os intervalos de 25/5 à risca.

## Problema 1: começar pode ser mais difícil do que continuar

Algumas tarefas são chatas, repetitivas ou difíceis de encarar. Quando penso na tarefa *inteira*, às vezes gasto mais energia negociando comigo mesmo do que executando o trabalho.

### Minha solução: o acordo dos 25 minutos

Eu digo para mim mesmo: **“São só 25 minutos. Depois disso, posso parar.”**

Esse compromisso torna a tarefa mais administrável. Não preciso terminar tudo, progredir perfeitamente nem saber exatamente quanto tempo levará. Só preciso começar.

Muitas vezes, depois que começo, a resistência diminui. Às vezes entro em um estado de *flow* e nem quero parar.

Um timer rígido interromperia esse ritmo. Por isso adicionei o atalho `a` ao Lo-fi Pomodoro: durante o foco, ele estende a sessão em **cinco minutos** por padrão. Também é possível configurar essa extensão com `--snooze`.

Quando o tempo termina, posso escolher:

- **Estou cansado ou distraído?** Faço a pausa. Já cumpri o compromisso dos 25 minutos.
- **Estou envolvido na tarefa e avançando?** Continuo, sem precisar reiniciar a sessão.

Essa é uma estratégia pessoal, não uma recomendação para todos ignorarem pausas programadas. **O timer é uma ferramenta, não uma regra.**

## Problema 2: música de foco não deveria exigir mais uma aba do navegador

As playlists do YouTube eram práticas, mas eu acabava ouvindo as mesmas músicas. Também queria que o som acompanhasse o ciclo de trabalho: música enquanto foco, áudio ambiente durante a pausa e controles discretos no terminal.

### Minha solução: um Pomodoro CLI com player de música

![Demonstração do Lo-fi Pomodoro no terminal](https://raw.githubusercontent.com/WittmannF/lofi-pomodoro/main/docs/assets/intro.gif)

O projeto oferece:

- Uma playlist padrão de faixas lo-fi com licenças abertas, obtidas do Chosic, baixadas e armazenadas em cache no primeiro uso.
- Suporte a uma pasta local com suas próprias músicas.
- Integração com playlists e presets do Spotify (requer Premium e o aplicativo Spotify ativo em algum dispositivo).
- Duração configurável de foco e pausas, além de sons ambientes como chuva, lareira e vento.
- Atalhos para pausar, pular, ignorar uma faixa **local** e estender o foco.

### Teste em menos de um minuto

Instale com o [uv](https://docs.astral.sh/uv/) e execute:

```bash
uv tool install lofi-pomodoro
pomodoro
```

Ou instale com `pip install lofi-pomodoro`.

Configure intervalos diferentes ou sua própria música:

```bash
pomodoro --work 50 --short 10 --long 30
pomodoro --music-folder ~/minhas-musicas
```

Use um preset do Spotify:

```bash
pomodoro --spotify lofi
```

O Spotify exige uma conta Premium. Na primeira execução, o CLI orienta a criação de um aplicativo/client ID do Spotify e a autorização pelo navegador.

Alguns controles úteis:

| Tecla | Ação |
|---|---|
| `a` | Adiciona cinco minutos ao foco (configurável com `--snooze`) |
| `p` | Pausa ou retoma o timer e a música |
| `s` | Pula a faixa |
| `i` | Ignora uma faixa no modo local |
| `q` | Encerra a sessão |

A ideia é reduzir o atrito para *começar a sessão*, não obrigar ninguém a trabalhar exatamente 25 minutos.

## Problema 3: essa combinação realmente melhora o foco?

Quando comecei a pesquisar, esperava encontrar uma resposta simples: “Pomodoro + lo-fi funciona”. A literatura é mais interessante, mas menos conclusiva.

Na verdade, são duas perguntas diferentes:

- **Tempo e esforço:** pausas estruturadas ajudam a regular o trabalho?
- **Ambiente sonoro:** a música de fundo ajuda a prestar atenção ou compete com a tarefa?

Estudos com universitários e tarefas de laboratório podem ajudar a pensar nessas questões, mas não provam diretamente que esse CLI aumenta a produtividade de programadores.

### 1. Pausas estruturadas podem ajudar, mas não são sempre superiores

Em um [estudo de Biwer e colaboradores (2023)](https://doi.org/10.1111/bjep.12593), 87 universitários fizeram pausas por conta própria ou em intervalos programados durante um dia de estudo. Nos grupos com pausas sistemáticas, os participantes relataram menos fadiga e distração e mais concentração e motivação. **Não houve diferença na conclusão das tarefas** entre os grupos.

É um argumento interessante a favor de um timer: programar pausas pode reduzir algumas decisões ao longo do trabalho. Mas não prova que o padrão 25/5 é o melhor para todo mundo.

Outro [estudo, de Smits e colaboradores (2025)](https://doi.org/10.3390/bs15070861), comparou Pomodoro, Flowtime e pausas autorreguladas. Não encontrou diferenças gerais de produtividade, conclusão de tarefas ou *flow*. Algumas trajetórias de fadiga e motivação foram menos favoráveis nos grupos com pausas programadas, embora os níveis gerais não tenham apresentado diferenças significativas.

**Minha interpretação:** vale usar intervalos fixos quando a estrutura ajuda a começar ou impede sessões intermináveis. Mas também vale adaptar o método quando o próprio timer se torna uma distração.

### 2. Música instrumental não é a mesma coisa que música com letra

[Souza e Barbosa (2023)](https://doi.org/10.5334/joc.273) compararam silêncio, lo-fi instrumental e música com letra em tarefas de memória verbal e visual, compreensão de leitura e aritmética.

Música com letra prejudicou o desempenho em algumas tarefas de memória e leitura. **Já o lo-fi instrumental não apresentou evidências convincentes de benefício *nem* de prejuízo em comparação ao silêncio** nesses experimentos.

Essa conclusão é mais útil do que “lo-fi deixa você mais inteligente”: se você está lendo ou escrevendo, a letra da música pode disputar sua atenção. A música instrumental pode ser mais tolerável, mas o silêncio talvez funcione tão bem quanto.

O experimento não avaliou desenvolvimento de software diretamente. Programar, depurar, escrever documentação e fazer tarefas repetitivas podem exigir formas diferentes de atenção.

### 3. Lo-fi é uma opção plausível para trabalhar, não uma fórmula comprovada

Lo-fi costuma usar batidas suaves, padrões repetitivos e texturas ambientes. Essas características ajudam a explicar sua popularidade como música de fundo, como discute uma [matéria do The Oxford Scientist](https://oxsci.org/the-science-behind-lo-fi-beats/). Trata-se de divulgação científica, não de prova direta de que uma playlist melhora o desempenho em programação.

Em um [estudo publicado em 2022](https://doi.org/10.1007/s41465-021-00226-3), Kirk e colaboradores compararam jazz, piano, lo-fi e ausência de música. Os grupos com música tiveram melhora em uma medida de atenção sustentada em relação ao início da sessão, sem evidências de superioridade de um gênero sobre os outros.

É um resultado interessante, mas com uma limitação importante: um teste de atenção em laboratório com faixas selecionadas não equivale a uma tarde de trabalho de engenharia.

### 4. O TDAH acrescenta diferenças individuais

Uma [revisão sistemática de 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10221503/) analisou 17 estudos sobre música e TDAH, incluindo musicoterapia ativa e escuta passiva. Encontrou possíveis benefícios em alguns domínios, mas os estudos variavam bastante em métodos, participantes, tipos de música e resultados.

Isso não prova que lo-fi ajude todas as pessoas com TDAH a se concentrar, nem que música substitua cuidados estabelecidos. É mais um motivo para evitar regras universais: o melhor ambiente sonoro pode depender da pessoa e da tarefa.

## Experimente encontrar seu próprio ambiente de foco

Em vez de tratar a pesquisa como uma prescrição, acho mais útil fazer um pequeno experimento pessoal. Em sessões com tarefas comparáveis, experimente:

| Configuração | Música | Timer |
|---|---|---|
| A | Silêncio | Sem timer |
| B | Lo-fi instrumental | Sem timer |
| C | Silêncio | Pomodoro flexível |
| D | Lo-fi instrumental | Pomodoro flexível |

Registre o quanto foi difícil começar, quantas vezes se distraiu, se houve progresso e como se sentiu depois. Alterne as condições entre os dias, em vez de testar uma única configuração durante vários dias consecutivos.

Isso não é um experimento científico controlado, mas uma maneira prática de descobrir o que funciona *para você*.

## Algumas notas de implementação para desenvolvedores

O CLI em Python usa [Rich](https://github.com/Textualize/rich) para a barra de progresso. O timer e os controles de música são coordenados com threads e filas, permitindo usar atalhos de teclado sem pressionar Enter.

No [repositório](https://github.com/WittmannF/lofi-pomodoro), você encontra:

- `pomodoro/__main__.py`: ciclo de trabalho/pausa, interação com o terminal e orquestração do áudio local.
- `pomodoro/playlist_cache.py`: download inicial das músicas e reutilização do cache.
- `pomodoro/spotify_player.py`: controle de reprodução do Spotify e autenticação PKCE.

Existem dois caminhos de reprodução: áudio local gerenciado pelo aplicativo ou reprodução controlada em um dispositivo Spotify existente. Os sons das pausas são locais nos dois modos.

O projeto também me lembrou da importância dos pequenos detalhes: guardar as faixas em cache, restaurar a configuração do terminal ao sair e prolongar o foco sem reiniciar o relógio.

## Considerações finais

O principal motivo para eu continuar usando o Lo-fi Pomodoro não é ter encontrado uma fórmula ideal de produtividade.

É que, nos dias em que uma tarefa parece especialmente chata, **“são só 25 minutos” torna o primeiro passo mais fácil**. E, depois de começar, posso descansar ou continuar se estiver avançando bem.

Música e timers são apoios opcionais, não regras universais. Use quando ajudarem. Adapte quando não ajudarem.

**Projeto:** [Lo-fi Pomodoro no GitHub](https://github.com/WittmannF/lofi-pomodoro). Sugestões, issues e contribuições são bem-vindas.

## Referências e leituras complementares

1. [Francesco Cirillo — A Técnica Pomodoro](https://www.pomodorotechnique.com/). Explicação oficial do método completo.
2. [Biwer et al. (2023) — Understanding effort regulation: Comparing ‘Pomodoro’ breaks and self-regulated breaks](https://doi.org/10.1111/bjep.12593).
3. [Smits, Wenzel & de Bruin (2025) — Investigating the Effectiveness of Self-Regulated, Pomodoro, and Flowtime Break-Taking Techniques Among Students](https://doi.org/10.3390/bs15070861).
4. [Souza & Barbosa (2023) — Should We Turn off the Music? Music with Lyrics Interferes with Cognitive Tasks](https://doi.org/10.5334/joc.273).
5. [Kirk et al. (2022) — Effects of Three Genres of Focus Music on Heart Rate Variability and Sustained Attention](https://doi.org/10.1007/s41465-021-00226-3).
6. [Música e TDAH — Revisão sistemática (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10221503/).
7. [The Oxford Scientist (2025) — The Science Behind Lo-fi Beats](https://oxsci.org/the-science-behind-lo-fi-beats/).
