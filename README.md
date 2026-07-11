# Deltarune Gear Optimizer

Little tool for figuring out who should wear what in Deltarune. Paste gear
tables from the wiki, mark what you actually own in your save, and it works
out the best loadouts — per character, or for the whole party sharing one
inventory pool.

Has a few different modes: max a single stat, balance the party with weighted
stats (weighted sum or "nobody left behind" maximin), quick playstyle presets,
and a boss tab where you can sketch out what elements a boss deals and get
counter-gear picks. The boss numbers are your own guesses, not game data — the
useful part is that it tells you *why* it rejected an item, so you can spot
traps like low-stat resist armor losing to plain high DEF.

Everything lives in localStorage, with JSON export/import for backups.

## Running it

```
npm install
npm run dev
```

`npm test` runs the optimizer tests (the branch-and-bound search is checked
against brute force).

Built with React + TypeScript + Vite, Tailwind v4.
