<div align="center">

# omadia-ui-mobile

### The omadia canvas, native on your phone — one declarative protocol, rendered by Expo.

React Native host (Expo, iOS first-class) for the **omadia canvas protocol**,
plus a platform-neutral protocol core. Agents stream a declarative UI tree;
this app renders it natively.

[![Status: work in progress](https://img.shields.io/badge/status-work%20in%20progress-orange.svg)](#status)
[![Expo](https://img.shields.io/badge/built%20with-Expo-000020.svg?logo=expo&logoColor=white)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![iOS first](https://img.shields.io/badge/iOS-first--class-999999.svg?logo=apple&logoColor=white)](#the-app-store-invariant)

[**omadia**](https://github.com/byte5ai/omadia) · [**Website**](https://omadia.ai) · [**Quickstart**](#-quickstart) · [**Protocol invariant**](#the-app-store-invariant)

</div>

---

## What's in the box

- **`@omadia/canvas-core`** — the platform-neutral protocol core: canvas tree
  types, RFC-6902 `treePatch`, `canvasStore`, the handshake FSM, a
  WebSocket-injected `CanvasSocket`, and an ajv validator built via standalone
  codegen (no `eval` — Hermes/CSP-safe).
- **`@omadia/mobile`** — the Expo app (TypeScript). Consumes `canvas-core`,
  renders the canvas tree with native components, and supports cross-device
  canvas hand-over via the per-user canvas registry.

```
packages/canvas-core/   protocol, treePatch, canvasStore, handshake FSM,
                        CanvasSocket (WebSocket-injected), ajv validator (standalone codegen)
apps/mobile/            Expo app (TypeScript), consumes @omadia/canvas-core
```

## ⚡ Quickstart

```bash
bun install
bun run gen        # compile the JSON-schema validators (no eval — Hermes/CSP-compliant)
bun run test       # canvas-core vitest suite (tests ported from omadia-ui)
bun run typecheck
```

Run the iOS app:

```bash
cd apps/mobile && bunx expo start --ios
```

## Canonical source & sync

The protocol core (sources, schemas, tests, and the 25 contract fixtures) is
**not vendored here** — it is synced at test/typecheck time from the canonical
[`@omadia/canvas-core`](https://github.com/byte5ai/omadia-ui-support/tree/main/packages/canvas-core)
package in `byte5ai/omadia-ui-support` (it left the omadia monorepo with
canvas-core 0.3.0) via `scripts/sync-canvas-core.mjs`. The synced files are
gitignored; only the package shell (`package.json`, `tsconfig.json`,
mobile-only dev tools) is committed.

A sibling checkout of `byte5ai/omadia-ui-support` is expected at
`../omadia-ui-support` (override with `OMADIA_UI_SUPPORT_REPO`). Run the sync
manually with `bun run sync`; `test` and `typecheck` run it automatically. This
is the same no-drift mechanism the other protocol consumers use — one schema, one source of truth.

## Agents

The app speaks the same agent protocol as the omadia-ui desktop host
(omadia-canvas-protocol/1.1, additive; spec 2042 §5.3, §5.14):

- **One agent per conversation.** Each canvas has an agent the user chooses
  before its first turn; it is fixed after that. The default agent the server
  names, or the only agent there is, is preselected (visibly); with several
  agents and no default nothing is sent until the user chooses. The client
  never picks one itself.
- **`agentId` in every turn** (`metadata.agentId` on the server). The server
  refuses a turn without one (`no_agent`).
- **Speaker on every message.** Agent messages show name and avatar; a refused
  or failed turn (`turn_error.systemNotice`) is a `system` notice, set apart,
  without avatar. Unknown notice codes render through their `text`.
- **Directory.** The `agents` message after the handshake (and the answer to
  `agents_get`); the kernel's `GET /api/v1/agents/directory?channel=web` has
  the same shape (`default_agent`).

The code lives in `apps/mobile/src/agents/`. `@omadia/canvas-core` does not
carry these fields yet, so `wireTap.ts` wraps the socket: it declares
`clientFeatures: ['agents']` and the UI `locale` in `handshake_select`, hands
the `agents` frame (which canvas-core drops) to the app and sends `agents_get`.
A server that does not announce the `agents` feature is served as before: no
picker, no `agentId`. Requires the kernel's agent-aware canvas channel
(`@omadia/ui-channel` with agent selection); the user-facing words are in
`texts.ts` (de/en).

## The App Store invariant

> **Apple App Store Guideline 2.5.2.** The protocol delivers *declarative UI
> descriptions only* (a JSON tree + RFC-6902 patches) — never executable or
> interpreted logic. This property is what makes the app shippable on iOS and
> must not be broken by any protocol extension.

## Status

Pre-release (`0.1.x`), developed alongside the
[omadia](https://github.com/byte5ai/omadia) platform and the omadia-ui desktop
host. APIs and the protocol surface may change without notice.

## Maintainership

omadia-ui-mobile is maintained by [byte5 GmbH](https://byte5.de) under the
GitHub organisation [`byte5ai`](https://github.com/byte5ai).
