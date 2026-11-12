---
title: 'Just 25 Minutes: Why I Built a Lo-fi Pomodoro CLI (and What Science Says)'
description: 'A personal approach to starting difficult tasks, a quick introduction to Pomodoro, the research on background music and breaks, and the Python CLI I built around it.'
pubDate: 2026-11-12
tags: ['Python', 'Productivity', 'Open Source', 'CLI', 'Music']
lang: 'en'
---

For years, I had almost the same browser tab open every day: YouTube search results for “lofi pomodoro.”

I'd pick a playlist, start working, and let the music and timer run. Eventually, I got tired of hearing the same tracks. I wanted my own music, control from the terminal, and an automatic transition from focus music to break sounds.

So I started building [Lo-fi Pomodoro](https://github.com/WittmannF/lofi-pomodoro), a Python CLI that combines a focus timer with local music or Spotify playback. I've used and improved it over the years, and recently made it available as an open-source tool.

But the most useful lesson wasn't about building a music player. It was about **making it easier to start a task, without letting a timer dictate when I have to stop**.

## First, what is the Pomodoro Technique?

The [Pomodoro Technique](https://www.pomodorotechnique.com/) was developed by Francesco Cirillo. Its familiar rhythm is simple:

1. Choose one task.
2. Work on it for **25 minutes**.
3. Take a **5-minute break**.
4. After four focus sessions, take a longer break (often 15–30 minutes).

The original technique goes beyond a countdown: it also includes planning work, dealing with interruptions, and reviewing your effort. But those four steps are enough to understand the timer in this article.

I don't follow the 25/5 pattern religiously.

## Problem 1: Starting can be harder than continuing

Some tasks are boring, repetitive, or hard to approach. When I think about the *entire* task, I can spend more energy negotiating with myself than doing it.

### My solution: The 25-minute deal

I tell myself: **“It's just 25 minutes. After that, I can stop.”**

That makes the task feel smaller. I don't need to finish everything, make perfect progress, or know exactly how long it will take. I only need to begin.

Often, once I'm working, the resistance fades. Sometimes I even get into a flow state and don't want to stop.

A rigid timer would interrupt that momentum. So I added the `a` shortcut to Lo-fi Pomodoro: while working, pressing it extends the current focus session by **five minutes** by default. The extension is configurable with `--snooze`.

When time is up, I get a choice:

- **Tired or distracted?** Take the break. I've kept my 25-minute commitment.
- **Engaged and making progress?** Keep going, without abandoning the session.

This is a personal strategy, not a claim that everyone should ignore scheduled breaks. **The timer is a tool, not a rule.**

## Problem 2: Focus music should not require another browser tab

YouTube playlists were convenient, but I kept hearing the same songs. I also wanted the sound to change with the work cycle: music while focusing, ambient audio during breaks, and a quiet way to manage everything from my terminal.

### My solution: A music-aware Pomodoro CLI

![Lo-fi Pomodoro terminal demo](https://raw.githubusercontent.com/WittmannF/lofi-pomodoro/main/docs/assets/intro.gif)

The project supports:

- A default playlist of openly licensed lo-fi tracks sourced from Chosic, downloaded and cached on first use.
- Your own local music folder.
- Spotify playlists and presets (Spotify Premium required, with a Spotify app running on a device).
- Configurable focus and break lengths, plus break sounds such as rain, fireplace, and wind.
- Keyboard shortcuts to pause, skip, ignore a **local** track, and extend focus time.

### Try it in under a minute

Install it with [uv](https://docs.astral.sh/uv/) and run:

```bash
uv tool install lofi-pomodoro
pomodoro
```

Or install with `pip install lofi-pomodoro`.

Try a longer focus interval or your own music:

```bash
pomodoro --work 50 --short 10 --long 30
pomodoro --music-folder ~/my-music
```

Use a Spotify preset:

```bash
pomodoro --spotify lofi
```

Spotify playback requires a Premium account. On first use, the CLI guides you through creating a Spotify app/client ID and browser authorization.

Some controls worth knowing:

| Key | Action |
|---|---|
| `a` | Add five minutes to focus (configurable with `--snooze`) |
| `p` | Pause or resume the timer and music |
| `s` | Skip a track |
| `i` | Ignore a track in local mode |
| `q` | Quit |

The goal is to make the *start of a session* frictionless. It isn't a demand to work exactly 25 minutes.

## Problem 3: Does this combination actually improve focus?

When I looked into the research, I hoped for a simple answer: “Pomodoro + lo-fi works.” The evidence is more interesting, and less definitive.

There are really two separate questions:

- **Timing and effort:** Can structured breaks make work easier to regulate?
- **The sound environment:** Does background music support attention, or steal it?

Research on students and laboratory tasks can inform these questions, but it doesn't directly prove that this CLI makes programmers more productive.

### 1. Structured breaks help in some contexts, but are not universally better

In a [2023 study by Biwer and colleagues](https://doi.org/10.1111/bjep.12593), 87 university students used either self-regulated breaks or scheduled breaks during a day of self-study. Participants in scheduled-break groups reported lower fatigue and distractedness, and higher concentration and motivation. **Task completion did not differ** between groups.

That is a useful argument for having a timer: scheduling breaks can remove some decisions from the workday. It does *not* establish that 25/5 is the best pattern for everyone.

A [2025 study by Smits and colleagues](https://doi.org/10.3390/bs15070861) compared Pomodoro, Flowtime, and self-regulated breaks. It found no overall differences in productivity, task completion, or flow. Some trajectories of fatigue and motivation were less favorable in the fixed-break conditions, even though overall levels did not differ significantly.

**My takeaway:** use scheduled intervals when structure helps you get started or prevents endless work sessions. Be willing to adapt when the schedule itself becomes distracting.

### 2. Instrumental music is not the same as music with lyrics

[Souza and Barbosa (2023)](https://doi.org/10.5334/joc.273) tested silence, instrumental lo-fi, and music with lyrics during verbal and visual memory, reading comprehension, and arithmetic tasks.

Music with lyrics impaired performance on several memory and reading tasks. **Instrumental lo-fi, however, did not show a credible benefit *or* harm compared with silence** in those experiments.

This is a better practical lesson than “lo-fi makes you smarter”: if you're reading or writing, lyrics may compete with the task. Instrumental music may be easier to tolerate, but silence might work just as well.

The study did not test software development specifically. Coding, debugging, writing documentation, and routine maintenance may place different demands on attention.

### 3. Lo-fi is plausible as focus music, not a proven productivity hack

Lo-fi often uses soft beats, repetitive patterns, and ambient textures. Those qualities help explain its appeal as background audio, as discussed in [The Oxford Scientist's overview](https://oxsci.org/the-science-behind-lo-fi-beats/). That article is science communication, not direct evidence that a particular playlist improves coding.

In a [study published in 2022](https://doi.org/10.1007/s41465-021-00226-3), Kirk and colleagues compared jazz, piano, lo-fi, and no-music conditions. The music groups showed improvements from baseline on a sustained-attention measure after listening; the researchers did not find evidence that one of the three music genres was superior.

It's a promising result, with an important limitation: a laboratory attention task and selected tracks are not the same thing as an afternoon of engineering work.

### 4. ADHD adds another layer of individual variation

A [2023 systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10221503/) considered 17 studies on music and ADHD, including active music therapy and passive listening. It reported potential benefits in some domains, but the studies differed widely in methods, participants, music, and outcomes.

That is not proof that lo-fi helps all people with ADHD focus, nor that music replaces established care. It's a reason to avoid universal claims: the best audio environment may depend on the person and the task.

## Experiment with your own focus setup

Rather than treating the research as a prescription, I think a small personal experiment is more useful. Over several comparable sessions, try:

| Setup | Music | Timer |
|---|---|---|
| A | Silence | No timer |
| B | Instrumental lo-fi | No timer |
| C | Silence | Flexible Pomodoro |
| D | Instrumental lo-fi | Flexible Pomodoro |

Note how hard it was to start, how often you got distracted, whether you made progress, and how tired you felt afterward. Alternate conditions rather than doing all of one setup on the same day.

This won't be a controlled scientific experiment. It's a practical way to learn which environment is helpful *for you*.

## A few implementation notes for developers

The Python CLI uses [Rich](https://github.com/Textualize/rich) for the progress bar. The timer and music controls are coordinated using threads and queues so keyboard shortcuts work without pressing Enter.

In the [repository](https://github.com/WittmannF/lofi-pomodoro), you'll find:

- `pomodoro/__main__.py`: the work/break cycle, terminal interaction, and local playback orchestration.
- `pomodoro/playlist_cache.py`: first-run downloads and reuse of local tracks.
- `pomodoro/spotify_player.py`: Spotify playback control and PKCE authorization.

There are two different playback paths: local audio handled by the app, or playback controlled through an existing Spotify device. Break sounds are played locally in either mode.

This project also taught me that small quality-of-life details matter: caching tracks, restoring terminal settings on exit, and extending a session without restarting the clock.

## Final thoughts

The strongest reason I keep using Lo-fi Pomodoro isn't that I have discovered an optimal productivity formula.

It's that on a day when a task feels tedious, **“just 25 minutes” makes starting feel possible**. And once I have started, I can rest or continue if I am making progress.

Music and timers are optional supports, not universal rules. Use them when they help. Change them when they don't.

**Project:** [Lo-fi Pomodoro on GitHub](https://github.com/WittmannF/lofi-pomodoro). Issues, suggestions, and contributions are welcome.

## References and further reading

1. [Francesco Cirillo — The Pomodoro Technique](https://www.pomodorotechnique.com/). Official explanation of the complete method.
2. [Biwer et al. (2023) — Understanding effort regulation: Comparing ‘Pomodoro’ breaks and self-regulated breaks](https://doi.org/10.1111/bjep.12593).
3. [Smits, Wenzel & de Bruin (2025) — Investigating the Effectiveness of Self-Regulated, Pomodoro, and Flowtime Break-Taking Techniques Among Students](https://doi.org/10.3390/bs15070861).
4. [Souza & Barbosa (2023) — Should We Turn off the Music? Music with Lyrics Interferes with Cognitive Tasks](https://doi.org/10.5334/joc.273).
5. [Kirk et al. (2022) — Effects of Three Genres of Focus Music on Heart Rate Variability and Sustained Attention](https://doi.org/10.1007/s41465-021-00226-3).
6. [Music and ADHD — Systematic Review (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10221503/).
7. [The Oxford Scientist (2025) — The Science Behind Lo-fi Beats](https://oxsci.org/the-science-behind-lo-fi-beats/).
