import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildNodeAction,
  buildValueAction,
  chartData,
  chartKind,
  choiceOptions,
  formatDuration,
  menubarItems,
  progressModel,
  timelinePlayheadPct,
  timelineTracks,
  treeNodes,
  vectorPathGeometry,
  type PrimitiveJson,
} from '../src/render/primitives';

// The canonical fixtures synced from @omadia/canvas-core — the same set the
// parity contract validates against the schema. Reading them here proves the
// mobile interpretation tracks the real protocol shapes, not a hand-copy.
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/canvas-core/fixtures',
);
const fixture = (name: string): PrimitiveJson =>
  JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), 'utf8')) as PrimitiveJson;

describe('progressModel', () => {
  it('reads the canonical 0..1 value as a percentage', () => {
    expect(progressModel(fixture('progress'))).toEqual({ indeterminate: false, percent: 65 });
  });
  it('tolerates a 0..100 producer', () => {
    expect(progressModel({ type: 'progress', value: 42 })).toEqual({
      indeterminate: false,
      percent: 42,
    });
  });
  it('flags indeterminate', () => {
    expect(progressModel({ type: 'progress', indeterminate: true })).toEqual({
      indeterminate: true,
    });
  });
  it('clamps an out-of-range percentage producer to 100', () => {
    expect(progressModel({ type: 'progress', value: 150 })).toEqual({
      indeterminate: false,
      percent: 100,
    });
  });
});

describe('chart', () => {
  it('extracts data points from the canonical fixture', () => {
    const data = chartData(fixture('chart'));
    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({ key: 'q1', label: 'Q1', value: 1200 });
  });
  it('falls back to y when value is absent', () => {
    expect(chartData({ type: 'chart', points: [{ pointKey: 'a', y: 7 }] })[0]?.value).toBe(7);
  });
  it('maps chartType to a known kind', () => {
    expect(chartKind(fixture('chart'))).toBe('bar');
    expect(chartKind({ type: 'chart', chartType: 'line' })).toBe('line');
    expect(chartKind({ type: 'chart', chartType: 'pie' })).toBe('pie');
    expect(chartKind({ type: 'chart' })).toBe('bar');
  });
});

describe('choice + actions', () => {
  it('parses the canonical options', () => {
    expect(choiceOptions(fixture('choice'))).toEqual([
      { value: 'staging', label: 'Staging' },
      { value: 'production', label: 'Production' },
    ]);
  });
  it('builds a value action defaulting the type and carrying payload.value', () => {
    expect(buildValueAction(fixture('choice'), 'choice_select', 'production')).toEqual({
      type: 'choice_select',
      payload: { value: 'production' },
      sourceId: 'fixture-choice',
    });
  });
  it('merges a node-declared action payload under the value', () => {
    const node: PrimitiveJson = {
      type: 'choice',
      id: 'c1',
      action: { type: 'pick', payload: { field: 'env' } },
    };
    expect(buildValueAction(node, 'choice_select', 'prod')).toEqual({
      type: 'pick',
      payload: { field: 'env', value: 'prod' },
      sourceId: 'c1',
    });
  });
  it('returns null for a node without an action type', () => {
    expect(buildNodeAction({ type: 'button', label: 'x' })).toBeNull();
  });
  it('builds a static node action', () => {
    expect(
      buildNodeAction({ type: 'button', id: 'b1', action: { type: 'rescan' } }),
    ).toEqual({ type: 'rescan', payload: undefined, sourceId: 'b1' });
  });
});

describe('menubar', () => {
  it('parses the canonical items', () => {
    const items = menubarItems(fixture('menubar'));
    expect(items.map((i) => i.label)).toEqual(['File', 'Edit', 'View']);
    expect(items[0]?.action).toBeNull();
  });
});

describe('tree', () => {
  it('parses the nested canonical nodes', () => {
    const nodes = treeNodes(fixture('tree').nodes);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.label).toBe('Layers');
    expect(nodes[0]?.children.map((c) => c.itemKey)).toEqual(['background', 'foreground']);
  });
});

describe('timeline', () => {
  it('parses tracks from the canonical fixture', () => {
    expect(timelineTracks(fixture('timeline')).map((t) => t.kind)).toEqual([
      'video',
      'audio',
      'marker',
    ]);
  });
  it('computes the playhead percentage', () => {
    expect(timelinePlayheadPct(fixture('timeline'))).toBe(0);
    expect(timelinePlayheadPct({ type: 'timeline', duration: 12000, playhead: 6000 })).toBe(50);
  });
});

describe('vector-path', () => {
  it('builds an open path and a tight viewBox from the canonical fixture', () => {
    const geo = vectorPathGeometry(fixture('vector-path'));
    expect(geo?.d).toBe('M 0 0 L 100 40 L 160 120');
    expect(geo?.viewBox).toBe('-8 -8 176 136');
  });
  it('closes the path when closed=true', () => {
    const geo = vectorPathGeometry({
      type: 'vector-path',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      closed: true,
    });
    expect(geo?.d.endsWith(' Z')).toBe(true);
  });
  it('returns null for an empty path', () => {
    expect(vectorPathGeometry({ type: 'vector-path', points: [] })).toBeNull();
  });
});

describe('media', () => {
  it('formats a duration in seconds', () => {
    expect(formatDuration(12000)).toBe('12.0s');
  });
});
