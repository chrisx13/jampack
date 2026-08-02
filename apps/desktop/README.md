# @jampack/desktop — client lourd (Tauri 2)

Le desktop enveloppe le build de `apps/web`. La partie Rust (`src-tauri/`)
se génère avec la CLI Tauri, une seule fois :

```bash
pnpm --filter @jampack/desktop exec tauri init
```

Réponses recommandées à l'assistant `tauri init` :

- App name : `JAMPACK`
- Window title : `JAMPACK`
- Web assets (frontendDist) : `../../web/dist`
- Dev server URL : `http://localhost:5173`
- Before dev command : `pnpm --filter @jampack/web dev`
- Before build command : `pnpm --filter @jampack/web build`

Ensuite :

```bash
pnpm --filter @jampack/desktop dev     # lance web + fenêtre native
pnpm --filter @jampack/desktop build   # binaire installable
```
