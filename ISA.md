---
task: omadia-ui-mobile — React-Native-Host (iOS first class) für das Omadia-Canvas-Protokoll
project: omadia-ui-mobile
effort: E3
phase: complete
progress: 35/35
mode: build
started: 2026-06-11T10:02:00+02:00
updated: 2026-06-11T10:25:00+02:00
---

## Problem

omadia-ui existiert nur als Electron-Desktop-App. Der Mobile-Plan (siehe `~/.claude/PAI/MEMORY/WORK/omadia-ui-mobile-plan/PLAN.md`) ist freigegeben: React Native + Expo, iOS first. Es fehlt das Repo mit extrahiertem, plattformneutralem Protokoll-Core und einer Expo-App, die ihn konsumiert.

## Vision

Ein eigenständiges Repo, in dem `packages/canvas-core` das Canvas-Protokoll plattformneutral trägt (dieselben Tests wie im Desktop-Host laufen grün) und `apps/mobile` eine native iOS-App ist, die sich mit derselben Middleware verbindet und die 11 Primitives nativ rendert — der Beweis der "ein Protokoll, viele Surfaces"-These.

## Out of Scope

Kein Refactor im omadia-ui-Repo (Phase-0-Rückintegration später). Kein Push/Notification-Relay. Kein Multi-Canvas/Tiling. Kein App-Store-Submission-Setup. Kein GitHub-Remote (lokales Repo). Keine Android-Gerätetests (Codebasis bleibt cross-platform).

## Principles

- Server-driven UI: das Protokoll liefert ausschließlich deklarative Beschreibungen — nie ausführbare Logik (App-Store-2.5.2-Invariante).
- Core ist plattformneutral: keine Node-, DOM- oder RN-Imports in `canvas-core/src`.
- Portierte Tests sind der Vertrag: was im Desktop-Host grün war, bleibt grün.

## Constraints

- bun/bunx ausschließlich — nie npm/npx.
- TypeScript strict durchgehend.
- Quelle der Schemas bleibt `omadia-ui/docs/protocol/schema` — Kopie hier, Sync-Pflicht dokumentiert.
- omadia-ui-Repo bleibt in dieser Session unverändert; keine Worktrees.

## Goal

Lauffähiges Workspace-Repo `~/sources/omadia-ui-mobile`: `canvas-core` mit portiertem Protokoll-Stack (Socket WS-injiziert), vorkompiliertem ajv-Validator und grüner Test-Suite; `apps/mobile` als Expo-TS-App, die canvas-core konsumiert, alle 11 Primitives nativ rendert und typecheck-clean ist.

## Criteria

- [x] ISC-1: Repo `~/sources/omadia-ui-mobile` existiert mit git (branch main)
- [x] ISC-2: bun-Workspace: Root-package.json mit `packages/*` und `apps/*`
- [x] ISC-3: .gitignore deckt node_modules, .expo, dist, validators.generated.mjs ab
- [x] ISC-4: README.md erklärt Struktur, Setup- und Test-Befehle
- [x] ISC-5: ISA.md im Repo-Root (diese Datei)
- [x] ISC-6: protocol.ts portiert, inhaltlich identisch zur Quelle
- [x] ISC-7: treePatch.ts portiert, inhaltlich identisch zur Quelle
- [x] ISC-8: handshake.ts portiert (nur Importpfad angepasst)
- [x] ISC-9: canvasStore.ts portiert (nur Importpfade angepasst)
- [x] ISC-10: canvasSocket.ts nutzt injizierte WebSocket-Factory — kein `ws`-Import im Core
- [x] ISC-11: ConnectionStatus-Typ in core (connection.ts) — kein Import aus Electron-ipc
- [x] ISC-12: SessionPersistence-Interface im Core erhalten
- [x] ISC-13: 6 Schema-Dateien unter packages/canvas-core/schema kopiert
- [x] ISC-14: genValidator.ts portiert, liest lokale Schemas
- [x] ISC-15: `bun run gen` erzeugt validators.generated.mjs ohne Fehler
- [x] ISC-16: validator.ts-Wrapper portiert
- [x] ISC-17: Kein `node:`-Import in canvas-core/src (tools/ ausgenommen)
- [x] ISC-18: canvas-core package.json: type module, exports, Scripts (gen/test/typecheck)
- [x] ISC-19: `tsc --noEmit` in canvas-core clean
- [x] ISC-20: protocol.test.ts grün
- [x] ISC-21: treePatch.test.ts grün
- [x] ISC-22: handshake.test.ts grün
- [x] ISC-23: canvasStore.test.ts grün
- [x] ISC-24: canvasSocket.test.ts auf injizierte WS-Factory portiert und grün
- [x] ISC-25: validator.test.ts grün
- [x] ISC-26: Gesamte Test-Suite exit 0 (`bun run test`)
- [x] ISC-27: Expo-App (TypeScript) unter apps/mobile scaffolded
- [x] ISC-28: apps/mobile konsumiert @omadia/canvas-core als workspace-Dependency
- [x] ISC-29: PrimitiveNode.native rendert alle 11 Primitive-Typen (container, pane, tabs, heading, text, table, list, toolbar, button, status, divider)
- [x] ISC-30: App-Shell verbindet CanvasSocket mit RN-WebSocket-Factory + Storage-Adapter
- [x] ISC-31: Typecheck der Mobile-App clean
- [x] ISC-32: Minimaler Server-URL-Eingabe-Screen (Onboarding) vorhanden
- [x] ISC-33: Anti: omadia-ui-Repo unverändert (git status clean)
- [x] ISC-34: Anti: kein npm/npx-Aufruf in Scripts oder Setup
- [x] ISC-35: Anti: keine Worktrees angelegt

## Test Strategy

| isc | type | check | threshold | tool |
|-----|------|-------|-----------|------|
| ISC-1–5 | structure | ls/git/Read | vorhanden | Bash/Read |
| ISC-6–14, 16–18 | code | diff/grep gegen Quelle bzw. Datei-Read | match/clean | Bash |
| ISC-15 | build | bun run gen | exit 0 | Bash |
| ISC-19, 31 | types | tsc --noEmit | exit 0 | Bash |
| ISC-20–26 | tests | bunx vitest run | exit 0, alle grün | Bash |
| ISC-27–30, 32 | app | Datei-Read + Typecheck | vorhanden + clean | Read/Bash |
| ISC-33 | anti | git status in omadia-ui | leer | Bash |
| ISC-34–35 | anti | grep Scripts / git worktree list | kein Treffer / nur main | Bash |

## Features

| name | description | satisfies | depends_on | parallelizable |
|------|-------------|-----------|------------|----------------|
| repo-scaffold | git, Workspace, gitignore, README, ISA | ISC-1–5 | — | false |
| core-port | Module kopieren, Socket/Connection adaptieren, Validator-Codegen | ISC-6–19 | repo-scaffold | false |
| core-tests | 6 Test-Dateien portieren, Socket-Test auf Factory umstellen | ISC-20–26 | core-port | true |
| expo-scaffold | create-expo-app, Workspace-Anbindung | ISC-27, ISC-28 | repo-scaffold | true |
| native-renderer | PrimitiveNode.native + App-Shell + Onboarding (→ Forge) | ISC-29–32 | core-port, expo-scaffold | true |

## Decisions

- 2026-06-11 10:02 — Eigenes Root-Repo statt Monorepo-Erweiterung (explizite Vorgabe Marcel). canvas-core lebt hier; Rückkonsum durch Electron-App später via Package-Publish oder Repo-Move. Schemas dupliziert — Quelle bleibt omadia-ui/docs, Sync-Pflicht im README.
- 2026-06-11 10:02 — CanvasSocket auf Standard-WebSocket-Handler-API (onmessage/onclose/onerror) mit injizierter Factory umgestellt: läuft mit RN-WebSocket nativ und mit `ws` unter Node — Core bleibt plattformneutral.
- 2026-06-11 10:02 — ApertureOscillation aus dem Plan-Lauf dieser Session übernommen (MVP-Schnitt, Prebuild-Pfad, Capability-Hints später) statt erneut zu invoken — identisches Designproblem, frisches Ergebnis.
- 2026-06-11 10:40 — Auth in MVP nachgezogen (war Plan-Phase-1 "High effort"): echte Middleware verlangt omadia_session-Cookie (WS-Upgrade 401 ohne). smoke.ts gegen echten Server verifiziert Transport+Protokollverhandlung bis Auth-Grenze. Login-Script-Versuch des Users → 401 auth.invalid_credentials (Request-Shape = Desktop-Referenz, also Credentials-/Account-seitig, nicht Script-Bug). Konsequenz: Login-Screen (Email/Passwort → /api/v1/auth/login/:id → Set-Cookie → WS-Cookie-Header) in die App gebaut; in-App-Eingabe umgeht Shell-Escaping. RN-Set-Cookie-Sichtbarkeit per Simulator zu verifizieren (offen).

## Verification

- ISC-1–5: ls/git — Repo, Workspace, .gitignore, README, ISA vorhanden (Bash-Probes, Session 2026-06-11)
- ISC-6–18: cp+sed-Port, Greps: kein `ws`-/`node:`-/ipc-Import in core/src; 6 Schemas gelistet
- ISC-15: `bun run gen` → "wrote …validators.generated.mjs (1 runtime helper import(s))"
- ISC-19: `bunx tsc --noEmit` canvas-core → exit 0
- ISC-20–26: `bunx vitest run` → "Test Files 6 passed (6), Tests 31 passed (31)"
- ISC-27/28: create-expo-app Scaffold + `workspace:*`-Dependency, bun install 860 packages
- ISC-29: 11 eindeutige `case`-Zweige in PrimitiveNode.tsx (rg | sort -u | wc -l = 11) + default-Fallback
- ISC-30: Greps App.tsx — createCanvasConnection, AppState-Listener, resync() on foreground
- ISC-31: `bunx tsc --noEmit` apps/mobile → exit 0 (eigener Lauf, nicht nur Forge)
- ISC-32: Onboarding TextInput + Connect in App.tsx (rg-Treffer)
- RUNTIME (2026-06-11 10:49): App startet im iPhone-17-Pro-Simulator (Expo Go SDK 56). metro.config.js löst NodeNext-`.js`-Specifier auf TS-Quelle → `iOS Bundled 716 modules`, keine Runtime-Errors. Screenshot zeigt Onboarding "Connect to Omadia Canvas". Login-Flow: Server-URL → prepare() probt Provider-Katalog → Passwort-Provider → Login-Screen → /api/v1/auth/login/local → Cookie → WS. Interaktives Durchtippen (Login mit echten Credentials, Canvas-Render) = User-Schritt; simctl/AppleScript-UI-Steuerung mangels Accessibility-Freigabe nicht möglich. Smoke gegen echte Middleware bestätigt Transport+Protokoll bis Auth-Grenze; Desktop-identischer Login-Request → 401 auth.invalid_credentials bei den getesteten Credentials.
- ISC-33: `git status --porcelain` in omadia-ui → leer
- ISC-34: rg "npm |npx " über alle package.json/README → keine Treffer
- ISC-35: `git worktree list` → nur main
- Runtime-Smoke gegen ECHTE Middleware (`bun tools/smoke.ts ws://127.0.0.1:8080/omadia-ui/canvas`): canvas-core verbindet, WS-Upgrade → 401 (auth required, dokumentiertes Verhalten); `/omadia-ui/info` bestätigt protocolVersions ["1.0"] + Canvas-Endpoint → Transport + Protokollverhandlung verifiziert. Voller ready+turn via `--login` (OMADIA_USER/OMADIA_PASS aus env) — wartet auf Credentials des Users. Simulator-UI-Render weiterhin offen.
