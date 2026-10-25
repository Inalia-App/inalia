---
theme: default
title: Inalia CLI Playground
description: A local Slidev deck for trying the Inalia CLI.
addons:
  - slidev-addon-inalia
---

# Inalia CLI Playground

A small deck for testing the local CLI and connecting a talk.

---

# Connect this deck

Run these commands from `.playground`:

```sh
pnpm install
pnpm inalia auth login
pnpm inalia slidev setup
pnpm dev
```

The `inalia` script builds and runs the CLI from the parent directory.
Setup installs `slidev-addon-inalia`, updates this deck, and saves the talk connection to `.env`.

---

# Try the connection

- Open the presenter view.
- Advance between slides and check the connected talk in Inalia.
- Run `pnpm inalia talk select` to choose another talk, then restart Slidev.

---
layout: center
---

# Ready to present

Use this slide to test navigation back and forth.
