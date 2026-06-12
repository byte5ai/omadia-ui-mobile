/** Pure (RN-free) interpretation of canvas primitives: parses the validated
 *  protocol shapes into render-ready view models and builds the upstream turn
 *  actions. Kept free of react-native so it unit-tests in a node runner — the
 *  drift-prone logic (chart/progress/vector-path/timeline math, action payload
 *  shaping) is verified here; PrimitiveNode.tsx only maps these to RN views.
 *
 *  The desktop renderer (omadia-ui app/src/renderer/src/render) is the
 *  reference; these helpers mirror its interpretation field-for-field so the
 *  two renderers stay in behavioural parity against the shared fixtures. */

export type PrimitiveJson = { type: string; [key: string]: unknown };

/** Upstream turn action — mirrors the desktop PrimitiveAction contract. The
 *  value-carrying variant is what closes the interactive loop: the orchestrator
 *  reads `payload.value` for a choice pick / input commit / toggle flip. */
export interface PrimitiveAction {
  type: string;
  payload?: unknown;
  sourceId?: string;
}

export const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const isPrimitiveNode = (value: unknown): value is PrimitiveJson =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PrimitiveJson).type === 'string';

export const getNodeArray = (value: unknown): PrimitiveJson[] =>
  Array.isArray(value) ? value.filter(isPrimitiveNode) : [];

type NodeAction = { type?: unknown; payload?: unknown } | undefined;

const nodeActionOf = (node: PrimitiveJson): NodeAction =>
  typeof node.action === 'object' && node.action !== null
    ? (node.action as { type?: unknown; payload?: unknown })
    : undefined;

/** A static node action (button, menubar item) → turn action, or null when the
 *  node declares no actionable `action.type`. */
export const buildNodeAction = (node: PrimitiveJson): PrimitiveAction | null => {
  const action = nodeActionOf(node);
  const type = getString(action?.type);
  if (!type) return null;
  return { type, payload: action?.payload, sourceId: getString(node.id) };
};

/** Merge the node's declared action payload with the control's current value
 *  (input commit, toggle flip, choice pick). Falls back to `defaultType` when
 *  the node names no action type — mirrors desktop's emitValue. */
export const buildValueAction = (
  node: PrimitiveJson,
  defaultType: string,
  value: unknown,
): PrimitiveAction => {
  const action = nodeActionOf(node);
  const base =
    typeof action?.payload === 'object' && action.payload !== null
      ? (action.payload as Record<string, unknown>)
      : {};
  return {
    type: getString(action?.type) ?? defaultType,
    payload: { ...base, value },
    sourceId: getString(node.id),
  };
};

// ── progress ────────────────────────────────────────────────────────────────

export type ProgressModel = { indeterminate: true } | { indeterminate: false; percent: number };

export const progressModel = (node: PrimitiveJson): ProgressModel => {
  if (node.indeterminate === true) return { indeterminate: true };
  const raw = getNumber(node.value) ?? 0;
  // schema value is 0..1; tolerate a 0..100 producer too (desktop parity).
  const percent = Math.min(Math.max(raw <= 1 ? raw * 100 : raw, 0), 100);
  return { indeterminate: false, percent };
};

// ── choice ──────────────────────────────────────────────────────────────────

export interface ChoiceOption {
  value: string;
  label: string;
}

export const choiceOptions = (node: PrimitiveJson): ChoiceOption[] =>
  (Array.isArray(node.options) ? node.options : []).flatMap((o: unknown) => {
    if (typeof o !== 'object' || o === null) return [];
    const value = getString((o as { value?: unknown }).value);
    if (value === undefined) return [];
    return [{ value, label: getString((o as { label?: unknown }).label) ?? value }];
  });

export const isDropdownChoice = (node: PrimitiveJson): boolean => node.variant === 'dropdown';

// ── toggle ────────────────────────────────────────────────────────────────--

export const isSwitchToggle = (node: PrimitiveJson): boolean => node.variant === 'switch';

// ── menubar ───────────────────────────────────────────────────────────────--

export interface MenubarItem {
  key: string;
  label: string;
  action: PrimitiveAction | null;
}

export const menubarItems = (node: PrimitiveJson): MenubarItem[] =>
  (Array.isArray(node.items) ? node.items : []).flatMap((item: unknown, i: number) => {
    if (typeof item !== 'object' || item === null) return [];
    const rec = item as PrimitiveJson;
    const label = getString(rec.label) ?? getString(rec.id) ?? String(i);
    return [{ key: getString(rec.id) ?? String(i), label, action: buildNodeAction(rec) }];
  });

// ── tree ──────────────────────────────────────────────────────────────────--

export interface TreeNodeModel {
  itemKey: string;
  label: string;
  children: TreeNodeModel[];
}

export const treeNodes = (value: unknown): TreeNodeModel[] =>
  (Array.isArray(value) ? value : []).flatMap((n: unknown) => {
    if (typeof n !== 'object' || n === null) return [];
    const rec = n as { itemKey?: unknown; label?: unknown; children?: unknown };
    const itemKey = getString(rec.itemKey);
    if (itemKey === undefined) return [];
    return [
      { itemKey, label: getString(rec.label) ?? itemKey, children: treeNodes(rec.children) },
    ];
  });

// ── chart ─────────────────────────────────────────────────────────────────--

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
}

export type ChartKind = 'bar' | 'line' | 'pie';

export const chartKind = (node: PrimitiveJson): ChartKind =>
  node.chartType === 'line' ? 'line' : node.chartType === 'pie' ? 'pie' : 'bar';

export const chartData = (node: PrimitiveJson): ChartDatum[] =>
  (Array.isArray(node.points) ? node.points : []).flatMap((p: unknown) => {
    if (typeof p !== 'object' || p === null) return [];
    const rec = p as Record<string, unknown>;
    const key = getString(rec.pointKey);
    if (key === undefined) return [];
    const value = getNumber(rec.value) ?? getNumber(rec.y) ?? 0;
    return [{ key, label: getString(rec.label) ?? key, value }];
  });

// ── timeline ────────────────────────────────────────────────────────────────

export interface TimelineTrack {
  id: string;
  kind: string;
}

export const timelineTracks = (node: PrimitiveJson): TimelineTrack[] =>
  (Array.isArray(node.tracks) ? node.tracks : []).flatMap((t: unknown) => {
    if (typeof t !== 'object' || t === null) return [];
    const rec = t as { id?: unknown; kind?: unknown };
    const id = getString(rec.id);
    if (id === undefined) return [];
    return [{ id, kind: getString(rec.kind) ?? 'clip' }];
  });

/** playhead position as a 0..100 percentage of the timeline duration. */
export const timelinePlayheadPct = (node: PrimitiveJson): number => {
  const duration = getNumber(node.duration) ?? 0;
  const playhead = getNumber(node.playhead) ?? 0;
  return duration > 0 ? Math.min(Math.max(playhead / duration, 0), 1) * 100 : 0;
};

// ── vector-path ───────────────────────────────────────────────────────────--

export interface VectorPathGeometry {
  d: string;
  viewBox: string;
}

export interface VectorPoint {
  x: number;
  y: number;
}

const vectorPoints = (node: PrimitiveJson): VectorPoint[] =>
  (Array.isArray(node.points) ? node.points : []).flatMap((p: unknown) => {
    if (typeof p !== 'object' || p === null) return [];
    const x = getNumber((p as { x?: unknown }).x);
    const y = getNumber((p as { y?: unknown }).y);
    return x === undefined || y === undefined ? [] : [{ x, y }];
  });

/** SVG path `d` + a padded viewBox tight around the points. null when empty. */
export const vectorPathGeometry = (node: PrimitiveJson): VectorPathGeometry | null => {
  const points = vectorPoints(node);
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - minX, 1);
  const h = Math.max(Math.max(...ys) - minY, 1);
  const pad = Math.max(w, h) * 0.05;
  const d =
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
    (node.closed === true ? ' Z' : '');
  return { d, viewBox: `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}` };
};

// ── media / canvas-region ────────────────────────────────────────────────────

export const formatDuration = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
