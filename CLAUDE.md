# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Obsidian plugin (`better-image-helper`) providing right-click OCR on images via Alibaba Cloud OCR API. Desktop-only (`isDesktopOnly: true` in `manifest.json`) because it reads local files and depends on Node APIs.

## Commands

- `pnpm dev` — esbuild watch mode, emits `dist/main.js` with inline sourcemaps.
- `pnpm build` — `tsc -noEmit` typecheck + esbuild production bundle. `postbuild` runs automatically and rewrites `timer.unref()` → `// timer.unref()` in `dist/main.js` (see below).
- `pnpm release:patch | release:minor | release:major` — bump `package.json` (no git tag), run `version` script to propagate to `manifest.json` + `versions.json`, then commit, tag (version-only, no `v` prefix), and push. The tag push triggers `.github/workflows/release.yml` which builds and attaches `dist/main.js` + `dist/manifest.json` to a GitHub Release.

No test or lint scripts are configured.

## Installing locally

Build output lands in `dist/`. To test in a real vault, copy `dist/main.js` and `dist/manifest.json` (and `dist/styles.css` if ever added) into `<vault>/.obsidian/plugins/better-image-helper/` and reload Obsidian.

## Architecture

Three source files, all in `src/`:

- `main.ts` — Plugin entry (`ImageOcrPlugin`). Registers three independent context-menu surfaces because Obsidian exposes different hook points per mode:
  - DOM `contextmenu` listener on `document` → covers Reading Mode and (via element walking) Live Preview rendered images.
  - Workspace `editor-menu` event → Source Mode (regex-matches `![...](...)` on the cursor line) and a fallback Live Preview path that scans `.cm-editor` for any `<img>`.
  - Workspace `file-menu` event → file-explorer right-click on image attachments (png/jpg/jpeg/gif/webp/svg).
  All four paths funnel into `addOcrMenuOption` → `performOcr` → `OcrResultModal`. The modal injects its own `<style>` block (no external CSS file) and handles preview, editable textarea with char/word count, copy, and "create as new note".
- `ocr-service.ts` — Alibaba Cloud OCR client. `recognizeImage` dispatches on `http` prefix: URL requests use `RecognizeGeneralRequest({ url })`; local files are streamed via `@alicloud/darabonba-stream` `readFromFilePath`. Note the response shape differs between the two paths — URL responses come back with `body.data` as a JSON *string* (`JSON.parse(...).content`), file responses as an object (`.data.content`). Several `@ts-ignore` comments paper over gaps in the Aliyun SDK types.
- `settings.ts` — `ImageOcrSettings` stores an array of `OcrServiceConfig` keyed by `type` (only `aliyun` is implemented today; the shape anticipates adding Baidu/Tencent). Credentials live in Obsidian's plugin data (`loadData`/`saveData`), *not* in `.env` at runtime — the `.env` mention in the README only applies at build time via the esbuild `node-globals` plugin.

## Build quirks worth knowing

- **esbuild `node-globals` plugin** (`esbuild.config.mjs`) intercepts `import process` and inlines `ALI_AK` / `ALI_SK` from the *build-time* environment. In practice this is dead code for end users — the plugin reads credentials from settings — but it means `process.env.*` in bundled deps resolves to the build host's env, not the user's.
- **`postbuild.mjs` comments out `timer.unref()`** in the bundled output. The Aliyun SDK calls `timer.unref()` (a Node-only Timer method) which throws in Electron/browser-like contexts. `ocr-service.ts` also installs a runtime polyfill on `global.setTimeout` as a belt-and-braces safeguard. Don't remove either without testing in a real Obsidian install.
- Release tags are **version-only, no `v` prefix** (e.g. `1.1.5`, not `v1.1.5`) — this is required by Obsidian's community plugin format. The `release:post` script and the GH Action both assume this.
- `manifest.json`, `versions.json`, and `package.json` must stay in lockstep. `version-bump.mjs` handles this when run via the `version` npm lifecycle hook.

## Docs

`docs/obsidian/publish-plugin.md` and `docs/obsidian/right-click.md` capture research notes on Obsidian's plugin submission process and context-menu API — useful reference if extending the menu surfaces or preparing a submission PR.
