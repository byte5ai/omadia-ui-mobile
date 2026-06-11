# Omadia UI — Mobile

React-Native-Host (Expo, iOS first class) für das Omadia-Canvas-Protokoll, plus plattformneutraler Protokoll-Core.

## Struktur

```
packages/canvas-core/   Protokoll, treePatch, canvasStore, Handshake-FSM,
                        CanvasSocket (WebSocket-injiziert), ajv-Validator (standalone codegen)
apps/mobile/            Expo-App (TypeScript), konsumiert @omadia/canvas-core
```

## Setup

```bash
bun install
bun run gen        # kompiliert die JSON-Schema-Validatoren (kein eval — Hermes/CSP-konform)
bun run test       # vitest-Suite des Cores (aus omadia-ui portierte Tests)
bun run typecheck
```

iOS-App starten: `cd apps/mobile && bunx expo start --ios`

## Schemas

`packages/canvas-core/schema/` ist eine **Kopie** — die kanonische Quelle bleibt
`omadia-ui/docs/protocol/schema/`. Bei Protokolländerungen dort: Schemas hierher
synchronisieren und `bun run gen` ausführen.

## Invariante (App Store Guideline 2.5.2)

Das Protokoll liefert ausschließlich deklarative UI-Beschreibungen (JSON-Tree + RFC-6902-Patches)
— niemals ausführbare oder interpretierte Logik. Diese Eigenschaft entscheidet über die
iOS-Shippability und darf von keiner Protokollerweiterung gebrochen werden.
