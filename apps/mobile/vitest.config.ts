import { defineConfig } from 'vitest/config';

// Node-environment unit tests for the RN-free primitive logic
// (src/render/primitives.ts). The renderer itself is reviewed visually through
// the dev gallery; this suite locks the drift-prone interpretation against the
// canonical fixtures.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
