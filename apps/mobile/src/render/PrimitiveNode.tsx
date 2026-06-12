import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  type PressableStateCallbackType,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Line as SvgLine,
  Path,
  Polygon,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';
import {
  lume,
  Surface,
  text as textPreset,
  textSecondary,
  mono,
  heading,
  containerTitle,
} from '../theme/lume';
import {
  buildNodeAction,
  buildValueAction,
  chartData,
  chartKind,
  choiceOptions,
  formatDuration,
  getNodeArray,
  getNumber,
  getString,
  isDropdownChoice,
  isPrimitiveNode,
  isSwitchToggle,
  menubarItems,
  progressModel,
  timelinePlayheadPct,
  timelineTracks,
  treeNodes,
  vectorPathGeometry,
  type ChartDatum,
  type PrimitiveAction,
  type PrimitiveJson,
  type TreeNodeModel,
} from './primitives';

export type { PrimitiveAction, PrimitiveJson } from './primitives';

interface PrimitiveNodeProps {
  node: PrimitiveJson;
  onAction?: (action: PrimitiveAction) => void;
}

const noop = () => {};

const getHeadingSize = (level: number): number => {
  const clamped = Math.max(1, Math.min(6, level));
  const sizes = [25, 24, 21, 18, 16, 14];
  return sizes[clamped - 1];
};

/** schema `tone` severity hint → Lume status colour. neutral/absent → none. */
const toneColor = (node: PrimitiveJson): string | undefined => {
  switch (node.tone) {
    case 'success':
      return lume.colors.successFg;
    case 'warning':
      return lume.colors.warningFg;
    case 'danger':
      return lume.colors.errorFg;
    case 'info':
      return lume.colors.accent;
    default:
      return undefined;
  }
};

const TABLE_FIRST_COLUMN_WIDTH = 152;
const TABLE_COLUMN_MIN_WIDTH = 136;
const TAB_SEGMENT_MIN_HEIGHT = 38;

export function PrimitiveNode({
  node,
  onAction = noop,
}: PrimitiveNodeProps): React.JSX.Element | null {
  switch (node.type) {
    case 'container': {
      const title = getString(node.title);
      const children = getNodeArray(node.children);

      return (
        <Surface variant="surface" style={styles.container}>
          {title ? <Text style={styles.containerTitle}>{title}</Text> : null}
          {children.map((child, index) => (
            <PrimitiveNode
              key={`${child.type}-${index}`}
              node={child}
              onAction={onAction}
            />
          ))}
        </Surface>
      );
    }
    case 'pane': {
      const title = getString(node.title);
      const container = isPrimitiveNode(node.container) ? node.container : null;
      const children = getNodeArray(node.children);

      return (
        <Surface variant="surface" style={styles.pane}>
          {title ? <Text style={styles.paneTitle}>{title}</Text> : null}
          {container ? (
            <PrimitiveNode node={container} onAction={onAction} />
          ) : null}
          {children.map((child, index) => (
            <PrimitiveNode
              key={`${child.type}-${index}`}
              node={child}
              onAction={onAction}
            />
          ))}
        </Surface>
      );
    }
    case 'tabs':
      return <TabsNode node={node} onAction={onAction} />;
    case 'heading': {
      const content = getString(node.content) ?? '';
      const size = getHeadingSize(getNumber(node.level) ?? 2);
      const tone = toneColor(node);

      return (
        <Text style={[styles.heading, { fontSize: size }, tone ? { color: tone } : null]}>
          {content}
        </Text>
      );
    }
    case 'text': {
      const tone = toneColor(node);
      return (
        <Text style={[styles.text, tone ? { color: tone } : null]}>
          {getString(node.content) ?? ''}
        </Text>
      );
    }
    case 'table':
      return <TableNode node={node} />;
    case 'list':
      return <ListNode node={node} />;
    case 'toolbar': {
      const children = getNodeArray(node.children);

      return (
        <View style={styles.toolbar}>
          {children.map((child, index) => (
            <PrimitiveNode
              key={`${child.type}-${index}`}
              node={child}
              onAction={onAction}
            />
          ))}
        </View>
      );
    }
    case 'button': {
      const label = getString(node.label) ?? 'Button';
      const action = buildNodeAction(node);

      return (
        <Pressable
          style={({ pressed }: PressableStateCallbackType) => [
            styles.buttonPressable,
            pressed ? styles.buttonPressablePressed : null,
          ]}
          onPress={() => action && onAction(action)}
        >
          <Surface variant="raised" style={styles.buttonSurface}>
            <Text style={styles.buttonLabel}>{label}</Text>
          </Surface>
        </Pressable>
      );
    }
    case 'input':
      return <InputNode node={node} onAction={onAction} />;
    case 'toggle':
      return <ToggleNode node={node} onAction={onAction} />;
    case 'choice':
      return <ChoiceNode node={node} onAction={onAction} />;
    case 'progress': {
      const model = progressModel(node);
      return (
        <Surface variant="sunken" style={styles.progressTrack}>
          {model.indeterminate ? (
            <View style={styles.progressIndeterminate}>
              <Surface variant="accentFill" style={styles.progressIndeterminateFill} />
            </View>
          ) : (
            <Surface
              variant="accentFill"
              style={[styles.progressFill, { width: `${model.percent}%` }]}
            />
          )}
        </Surface>
      );
    }
    case 'image': {
      const src = getString(node.src);
      const altText = getString(node.altText) ?? '';
      if (!src) {
        return (
          <Surface variant="sunken" style={styles.imageFallback}>
            <Text style={styles.imageAlt}>{altText || 'image'}</Text>
          </Surface>
        );
      }
      return (
        <Surface variant="sunken" style={styles.imageFrame}>
          <Image
            accessibilityLabel={altText}
            resizeMode="cover"
            source={{ uri: src }}
            style={styles.image}
          />
        </Surface>
      );
    }
    case 'form': {
      const title = getString(node.title);
      const children = getNodeArray(node.children);
      return (
        <Surface variant="surface" style={styles.container}>
          {title ? <Text style={styles.containerTitle}>{title}</Text> : null}
          {children.map((child, index) => (
            <PrimitiveNode key={`${child.type}-${index}`} node={child} onAction={onAction} />
          ))}
        </Surface>
      );
    }
    case 'menubar': {
      const items = menubarItems(node);
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.menubar}
        >
          {items.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => item.action && onAction(item.action)}
              style={({ pressed }: PressableStateCallbackType) => [
                styles.menubarItem,
                pressed ? styles.menubarItemPressed : null,
              ]}
            >
              <Text style={styles.menubarLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      );
    }
    case 'tree':
      return (
        <View style={styles.tree}>
          <TreeBranch nodes={treeNodes(node.nodes)} depth={0} />
        </View>
      );
    case 'chart':
      return <ChartNode node={node} />;
    case 'timeline': {
      const tracks = timelineTracks(node);
      const playheadPct = timelinePlayheadPct(node);
      return (
        <Surface variant="sunken" style={styles.timeline}>
          {tracks.map((track) => (
            <View key={track.id} style={styles.timelineTrack}>
              <Text style={styles.timelineKind}>{track.kind}</Text>
              <View style={styles.timelineLane}>
                <View style={[styles.timelinePlayhead, { left: `${playheadPct}%` }]} />
              </View>
            </View>
          ))}
        </Surface>
      );
    }
    case 'vector-path': {
      const geo = vectorPathGeometry(node);
      if (!geo) return null;
      return (
        <Surface variant="sunken" style={styles.vectorFrame}>
          <Svg viewBox={geo.viewBox} style={styles.vector}>
            <Path
              d={geo.d}
              fill="none"
              stroke={lume.colors.accent}
              strokeWidth={2}
            />
          </Svg>
        </Surface>
      );
    }
    case 'media': {
      const mediaType = getString(node.mediaType) ?? 'media';
      const duration = getNumber(node.duration) ?? 0;
      return (
        <Surface variant="sunken" style={styles.mediaShell}>
          <Text style={styles.mediaKind}>{mediaType}</Text>
          <Text style={styles.mediaMeta}>{formatDuration(duration)}</Text>
        </Surface>
      );
    }
    case 'canvas-region': {
      const width = getNumber(node.width) ?? 1;
      const height = getNumber(node.height) ?? 1;
      const ratio = height > 0 ? width / height : 1;
      return (
        <Surface variant="sunken" style={[styles.canvasRegion, { aspectRatio: ratio }]}>
          <Text style={styles.canvasRegionMeta}>{`${width}×${height}`}</Text>
        </Surface>
      );
    }
    case 'status': {
      const tone = toneColor(node);
      const value = getString(node.text) ?? '';
      if (tone) {
        return (
          <View
            style={[
              styles.statusChip,
              { backgroundColor: `${tone}1f`, borderColor: `${tone}47` },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: tone }]} />
            <Text style={[styles.statusChipText, { color: tone }]}>{value}</Text>
          </View>
        );
      }
      return <Text style={styles.statusText}>{value}</Text>;
    }
    case 'divider':
      return <View style={styles.divider} />;
    default:
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>{node.type}</Text>
        </View>
      );
  }
}

interface TabItem {
  label: string;
  child: PrimitiveJson;
}

interface TabsNodeProps {
  node: PrimitiveJson;
  onAction: (action: PrimitiveAction) => void;
}

function TabsNode({ node, onAction }: TabsNodeProps): React.JSX.Element | null {
  const tabs = useMemo<TabItem[]>(() => {
    if (!Array.isArray(node.tabs)) {
      return [];
    }

    return node.tabs.flatMap((tab: unknown) => {
      if (
        typeof tab !== 'object' ||
        tab === null ||
        typeof (tab as { label?: unknown }).label !== 'string' ||
        !isPrimitiveNode((tab as { child?: unknown }).child)
      ) {
        return [];
      }

      return [
        {
          label: (tab as { label: string }).label,
          child: (tab as { child: PrimitiveJson }).child,
        },
      ];
    });
  }, [node.tabs]);

  const initialIndex = useMemo(() => {
    if (tabs.length === 0) {
      return 0;
    }

    const activeStep = getNumber(node.activeStep) ?? 0;
    return Math.max(0, Math.min(tabs.length - 1, activeStep));
  }, [node.activeStep, tabs.length]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const clampedIndex =
    tabs.length === 0 ? 0 : Math.max(0, Math.min(tabs.length - 1, activeIndex));

  if (tabs.length === 0) {
    return null;
  }

  return (
    <View style={styles.tabsWrap}>
      <Surface style={styles.tabTrack} variant="sunken">
        <View style={styles.tabRow}>
        {tabs.map((tab: TabItem, index: number) => {
          const active = index === clampedIndex;

          return (
            <Pressable
              key={`${tab.label}-${index}`}
              onPress={() => setActiveIndex(index)}
              style={({ pressed }: PressableStateCallbackType) => [
                styles.tabSegmentPressable,
                pressed ? styles.tabSegmentPressed : null,
              ]}
            >
              {active ? (
                <Surface style={styles.tabSegmentActive} variant="accentSubtle">
                  <Text
                    numberOfLines={1}
                    style={[styles.tabLabel, styles.tabLabelActive]}
                  >
                    {tab.label}
                  </Text>
                </Surface>
              ) : (
                <View style={styles.tabSegment}>
                  <Text numberOfLines={1} style={styles.tabLabel}>
                    {tab.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
        </View>
      </Surface>
      <View style={styles.tabPanel}>
        <PrimitiveNode node={tabs[clampedIndex].child} onAction={onAction} />
      </View>
    </View>
  );
}

interface TableColumn {
  fieldKey: string;
  label: string;
}

interface TableRow {
  rowKey: string;
  cells: Record<string, unknown>;
}

function TableNode({ node }: { node: PrimitiveJson }): React.JSX.Element {
  const columns = useMemo<TableColumn[]>(() => {
    if (!Array.isArray(node.columns)) {
      return [];
    }

    return node.columns.flatMap((column: unknown) => {
      if (
        typeof column !== 'object' ||
        column === null ||
        typeof (column as { fieldKey?: unknown }).fieldKey !== 'string' ||
        typeof (column as { label?: unknown }).label !== 'string'
      ) {
        return [];
      }

      return [
        {
          fieldKey: (column as { fieldKey: string }).fieldKey,
          label: (column as { label: string }).label,
        },
      ];
    });
  }, [node.columns]);

  const rows = useMemo<TableRow[]>(() => {
    if (!Array.isArray(node.rows)) {
      return [];
    }

    return node.rows.flatMap((row: unknown) => {
      if (
        typeof row !== 'object' ||
        row === null ||
        typeof (row as { rowKey?: unknown }).rowKey !== 'string' ||
        typeof (row as { cells?: unknown }).cells !== 'object' ||
        (row as { cells?: unknown }).cells === null ||
        Array.isArray((row as { cells?: unknown }).cells)
      ) {
        return [];
      }

      return [
        {
          rowKey: (row as { rowKey: string }).rowKey,
          cells: (row as { cells: Record<string, unknown> }).cells,
        },
      ];
    });
  }, [node.rows]);

  return (
    <Surface style={styles.tableShell} variant="sunken">
      <ScrollView
        contentContainerStyle={styles.table}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tableScroll}
      >
        <View>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {columns.map((column: TableColumn, index: number) => {
            const firstColumn = index === 0;
            return (
              <View
                key={column.fieldKey}
                style={[
                  styles.tableCell,
                  styles.tableHeaderCell,
                  firstColumn ? styles.tableFirstCell : styles.tableDataCell,
                  firstColumn ? styles.tableFirstHeaderCell : null,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tableHeaderText,
                    firstColumn ? styles.tableFirstHeaderText : null,
                  ]}
                >
                  {column.label}
                </Text>
              </View>
            );
          })}
        </View>
        {rows.map((row: TableRow) => (
          <View key={row.rowKey} style={styles.tableRow}>
            {columns.map((column: TableColumn, index: number) => {
              const firstColumn = index === 0;
              const cellValue = String(row.cells[column.fieldKey] ?? '');
              return (
                <View
                  key={column.fieldKey}
                  style={[
                    styles.tableCell,
                    firstColumn ? styles.tableFirstCell : styles.tableDataCell,
                    firstColumn ? styles.tableFirstBodyCell : null,
                  ]}
                >
                  <Text
                    numberOfLines={firstColumn ? 2 : undefined}
                    style={[
                      styles.tableCellText,
                      firstColumn ? styles.tableFirstCellText : null,
                    ]}
                  >
                    {cellValue}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  </Surface>
  );
}

function ListNode({ node }: { node: PrimitiveJson }): React.JSX.Element {
  const items = useMemo(() => {
    if (!Array.isArray(node.items)) {
      return [];
    }

    return node.items.flatMap((item: unknown) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as { itemKey?: unknown }).itemKey !== 'string'
      ) {
        return [];
      }

      return [
        {
          itemKey: (item as { itemKey: string }).itemKey,
          label: getString((item as { label?: unknown }).label),
          tone: toneColor(item as PrimitiveJson),
        },
      ];
    });
  }, [node.items]);

  return (
    <View style={styles.list}>
      {items.map((item: { itemKey: string; label?: string; tone?: string }) => (
        <View key={item.itemKey} style={styles.listRow}>
          <Text style={[styles.listBullet, item.tone ? { color: item.tone } : null]}>
            {'\u2022'}
          </Text>
          <Text style={[styles.listItem, item.tone ? { color: item.tone } : null]}>
            {item.label ?? item.itemKey}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** `input` keeps draft text client-side; commits on blur/submit as a turn. */
function InputNode({ node, onAction }: Required<PrimitiveNodeProps>): React.JSX.Element {
  const initial = getString(node.value) ?? '';
  const [value, setValue] = useState(initial);
  const [last, setLast] = useState(initial);
  const label = getString(node.label);
  const commit = (): void => {
    if (value === last) return;
    setLast(value);
    onAction(buildValueAction(node, 'input_change', value));
  };
  return (
    <View style={styles.controlBlock}>
      {label ? <Text style={styles.controlLabel}>{label}</Text> : null}
      <Surface variant="raised" style={styles.inputSurface}>
        <TextInput
          style={styles.inputField}
          value={value}
          placeholder={getString(node.placeholder) ?? ''}
          placeholderTextColor={lume.colors.textTertiary}
          onChangeText={setValue}
          onBlur={commit}
          onSubmitEditing={commit}
          returnKeyType="done"
        />
      </Surface>
    </View>
  );
}

/** `toggle` — checkbox (default) or switch; flips client-side, reports upstream. */
function ToggleNode({ node, onAction }: Required<PrimitiveNodeProps>): React.JSX.Element {
  const [value, setValue] = useState(Boolean(node.value));
  const label = getString(node.label);
  const flip = (next: boolean): void => {
    setValue(next);
    onAction(buildValueAction(node, 'toggle_change', next));
  };
  void isSwitchToggle(node); // both variants render as a native Switch on mobile
  return (
    <View style={styles.toggleRow}>
      <Switch
        value={value}
        onValueChange={flip}
        trackColor={{ false: lume.colors.loading, true: lume.colors.accentSubtle }}
        thumbColor={value ? lume.colors.accent : lume.colors.textTertiary}
      />
      {label ? <Text style={styles.toggleLabel}>{label}</Text> : null}
    </View>
  );
}

/** `choice` locks after the pick; the chosen option stays highlighted until the
 *  answering turn replaces the tree (beam lifecycle, parity with desktop). */
function ChoiceNode({ node, onAction }: Required<PrimitiveNodeProps>): React.JSX.Element | null {
  const options = choiceOptions(node);
  const [value, setValue] = useState(getString(node.value) ?? '');
  const [picked, setPicked] = useState(false);
  const label = getString(node.label);
  if (options.length === 0) return null;
  const pick = (next: string): void => {
    if (picked) return;
    setValue(next);
    setPicked(true);
    onAction(buildValueAction(node, 'choice_select', next));
  };
  const dropdown = isDropdownChoice(node);
  return (
    <View style={styles.controlBlock}>
      {label ? <Text style={styles.controlLabel}>{label}</Text> : null}
      <View style={dropdown ? styles.choiceDropdown : styles.choiceRadioGroup}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              disabled={picked}
              onPress={() => pick(option.value)}
              style={({ pressed }: PressableStateCallbackType) => [
                styles.choiceOption,
                active ? styles.choiceOptionActive : null,
                pressed && !picked ? styles.choiceOptionPressed : null,
              ]}
            >
              <Text style={[styles.choiceOptionText, active ? styles.choiceOptionTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** recursive disclosure list; parent nodes start expanded and collapse on tap. */
function TreeBranch({ nodes, depth }: { nodes: TreeNodeModel[]; depth: number }): React.JSX.Element {
  return (
    <View>
      {nodes.map((node) => (
        <TreeRow key={node.itemKey} node={node} depth={depth} />
      ))}
    </View>
  );
}

function TreeRow({ node, depth }: { node: TreeNodeModel; depth: number }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <View>
      <Pressable
        disabled={!hasChildren}
        onPress={() => setOpen((o) => !o)}
        style={[styles.treeRow, { paddingLeft: 8 + depth * 16 }]}
      >
        <Text style={styles.treeTwist}>{hasChildren ? (open ? '▾' : '▸') : '·'}</Text>
        <Text style={styles.treeLabel}>{node.label}</Text>
      </Pressable>
      {hasChildren && open ? <TreeBranch nodes={node.children} depth={depth + 1} /> : null}
    </View>
  );
}

const CHART_SLICE_COLORS = [
  lume.colors.accent,
  lume.colors.successFg,
  lume.colors.warningFg,
  lume.colors.errorFg,
  lume.colors.accentHover,
  lume.colors.textTertiary,
];

const fmtChart = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');

/** evenly-rounded axis ticks (1/2/5 ladder) spanning [min, max] — desktop parity */
function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || 1;
  const rawStep = span / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(v);
  return out;
}

function BarChart({ data }: { data: ChartDatum[] }): React.JSX.Element {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <View style={styles.chartBars}>
      {data.map((d) => (
        <View key={d.key} style={styles.chartBarRow}>
          <Text numberOfLines={1} style={styles.chartBarLabel}>
            {d.label}
          </Text>
          <View style={styles.chartBarTrack}>
            <Surface
              variant="accentFill"
              style={[styles.chartBarFill, { width: `${(Math.abs(d.value) / max) * 100}%` }]}
            />
          </View>
          <Text style={styles.chartBarValue}>{fmtChart(d.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function LineChart({ data }: { data: ChartDatum[] }): React.JSX.Element {
  const W = 640;
  const H = 260;
  const M = { top: 14, right: 18, bottom: 30, left: 54 };
  const values = data.map((d) => d.value);
  const dataMax = Math.max(...values);
  const dataMin = Math.min(...values, 0);
  const ticks = niceTicks(dataMin, dataMax, 4);
  const yMin = Math.min(dataMin, ticks[0] ?? dataMin);
  const yMax = Math.max(dataMax, ticks.at(-1) ?? dataMax);
  const span = yMax - yMin || 1;
  const innerW = W - M.left - M.right;
  const x = (i: number): number =>
    data.length > 1 ? M.left + (i * innerW) / (data.length - 1) : M.left + innerW / 2;
  const y = (v: number): number => M.top + (H - M.top - M.bottom) * (1 - (v - yMin) / span);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} style={styles.chartSvg}>
      {ticks.map((t) => (
        <G key={t}>
          <SvgLine
            x1={M.left}
            x2={W - M.right}
            y1={y(t)}
            y2={y(t)}
            stroke={lume.colors.borderSubtleTop}
            strokeWidth={1}
          />
          <SvgText x={M.left - 8} y={y(t) + 4} fill={lume.colors.textTertiary} fontSize={12} textAnchor="end">
            {fmtChart(t)}
          </SvgText>
        </G>
      ))}
      <Polyline points={pts} fill="none" stroke={lume.colors.accent} strokeWidth={2} />
      {data.map((d, i) => (
        <Circle key={d.key} cx={x(i)} cy={y(d.value)} r={3.5} fill={lume.colors.accentActive} />
      ))}
      {data.map((d, i) =>
        i % labelEvery === 0 ? (
          <SvgText key={d.key} x={x(i)} y={H - 8} fill={lume.colors.textTertiary} fontSize={12} textAnchor="middle">
            {d.label}
          </SvgText>
        ) : null,
      )}
    </Svg>
  );
}

function PieChart({ data }: { data: ChartDatum[] }): React.JSX.Element {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const slice = (Math.max(d.value, 0) / total) * 2 * Math.PI;
    const x1 = Math.cos(angle);
    const y1 = Math.sin(angle);
    angle += slice;
    const x2 = Math.cos(angle);
    const y2 = Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    return {
      key: d.key,
      label: d.label,
      value: d.value,
      color: CHART_SLICE_COLORS[i % CHART_SLICE_COLORS.length],
      pct: Math.round((Math.max(d.value, 0) / total) * 100),
      d: `M 0 0 L ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} Z`,
    };
  });
  return (
    <View style={styles.chartPieWrap}>
      <Svg viewBox="-1.1 -1.1 2.2 2.2" style={styles.chartPie}>
        {slices.map((s) => (
          <Path key={s.key} d={s.d} fill={s.color} />
        ))}
      </Svg>
      <View style={styles.chartLegend}>
        {slices.map((s) => (
          <View key={s.key} style={styles.chartLegendRow}>
            <View style={[styles.chartLegendChip, { backgroundColor: s.color }]} />
            <Text style={styles.chartLegendLabel}>{s.label}</Text>
            <Text style={styles.chartLegendValue}>{`${fmtChart(s.value)} (${s.pct}%)`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ChartNode({ node }: { node: PrimitiveJson }): React.JSX.Element {
  const data = chartData(node);
  if (data.length === 0) {
    return (
      <Surface variant="sunken" style={styles.chartEmpty}>
        <Text style={styles.chartEmptyNote}>keine Datenpunkte</Text>
      </Surface>
    );
  }
  const kind = chartKind(node);
  return (
    <Surface variant="sunken" style={styles.chartFrame}>
      {kind === 'line' ? <LineChart data={data} /> : kind === 'pie' ? <PieChart data={data} /> : <BarChart data={data} />}
    </Surface>
  );
}

const styles = StyleSheet.create({
  buttonLabel: {
    color: lume.colors.text,
    fontFamily: lume.fonts.structuralSemibold,
    fontSize: 14,
  },
  buttonPressable: {
    alignSelf: 'flex-start',
    borderRadius: lume.radius.pill,
  },
  buttonPressablePressed: {
    opacity: 0.84,
  },
  buttonSurface: {
    borderRadius: lume.radius.pill,
    justifyContent: 'center',
    minHeight: lume.controls.minTouchHeight,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  container: {
    borderRadius: lume.radius.md,
    gap: lume.spacing.stackGap,
    padding: lume.spacing.containerPadding,
  },
  containerTitle: {
    ...containerTitle,
  },
  divider: {
    backgroundColor: lume.colors.borderSubtleBtm,
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  fallback: {
    borderColor: lume.colors.errorEdge,
    borderRadius: lume.radius.sm,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fallbackText: {
    color: lume.colors.errorFg,
    fontSize: 13,
    fontFamily: lume.fonts.mono,
  },
  heading: {
    ...heading,
    color: lume.colors.text,
  },
  list: {
    gap: 2,
  },
  listRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  listBullet: {
    ...textPreset,
    color: lume.colors.accent,
    fontSize: 15,
    lineHeight: 22,
    paddingLeft: 4,
    width: 20,
  },
  listItem: {
    ...textPreset,
    color: lume.colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  pane: {
    borderRadius: lume.radius.md,
    gap: lume.spacing.stackGap,
    padding: lume.spacing.containerPadding,
  },
  paneTitle: {
    ...containerTitle,
  },
  statusText: {
    ...mono,
    color: lume.colors.textTertiary,
    fontSize: 13,
  },
  statusChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: lume.radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  statusChipText: {
    fontFamily: lume.fonts.structuralSemibold,
    fontSize: 13,
  },
  tabLabel: {
    ...textSecondary,
    color: lume.colors.textSecondary,
    fontSize: 13,
    fontFamily: lume.fonts.structuralSemibold,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: lume.colors.accent,
  },
  tabPanel: {
    marginTop: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tabSegment: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: TAB_SEGMENT_MIN_HEIGHT,
    minWidth: 0,
    paddingHorizontal: 14,
  },
  tabSegmentActive: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: TAB_SEGMENT_MIN_HEIGHT,
    paddingHorizontal: 14,
    shadowColor: lume.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  tabSegmentPressed: {
    opacity: 0.9,
  },
  tabSegmentPressable: {
    borderRadius: 12,
    flex: 1,
  },
  tabTrack: {
    borderRadius: 14,
    padding: 4,
  },
  table: {
    paddingBottom: 4,
  },
  tableCell: {
    borderBottomColor: lume.colors.borderSubtleBtm,
    borderBottomWidth: 1,
    justifyContent: 'center',
    minHeight: lume.controls.minTouchHeight,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  tableCellText: {
    ...mono,
    color: lume.colors.text,
    fontSize: 14,
  },
  tableDataCell: {
    minWidth: TABLE_COLUMN_MIN_WIDTH,
  },
  tableHeaderCell: {
    backgroundColor: lume.colors.insetHighlight,
    borderBottomColor: lume.colors.borderBtm,
  },
  tableFirstBodyCell: {
    borderRightColor: lume.colors.borderSubtleTop,
    borderRightWidth: 1,
  },
  tableFirstCell: {
    minWidth: TABLE_FIRST_COLUMN_WIDTH,
    width: TABLE_FIRST_COLUMN_WIDTH,
  },
  tableFirstCellText: {
    fontFamily: lume.fonts.monoMedium,
  },
  tableFirstHeaderCell: {
    borderRightColor: lume.colors.borderTop,
    borderRightWidth: 1,
  },
  tableFirstHeaderText: {
    color: lume.colors.text,
    fontFamily: lume.fonts.monoMedium,
  },
  tableHeaderRow: {
    borderTopColor: lume.colors.borderSubtleTop,
    borderTopWidth: 1,
  },
  tableHeaderText: {
    ...mono,
    color: lume.colors.textSecondary,
    fontSize: 13,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableShell: {
    borderRadius: lume.radius.md,
  },
  tableScroll: {
    maxWidth: '100%',
  },
  tabsWrap: {
    marginVertical: 4,
  },
  text: {
    ...textPreset,
    color: lume.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  controlBlock: {
    gap: 6,
    paddingVertical: 2,
  },
  controlLabel: {
    ...containerTitle,
  },
  inputSurface: {
    borderRadius: lume.radius.sm,
    justifyContent: 'center',
    minHeight: lume.controls.minTouchHeight,
    paddingHorizontal: 12,
  },
  inputField: {
    color: lume.colors.text,
    fontFamily: lume.fonts.structural,
    fontSize: 15,
    paddingVertical: 10,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  toggleLabel: {
    ...textPreset,
    color: lume.colors.text,
    flexShrink: 1,
    fontSize: 15,
  },
  choiceRadioGroup: {
    gap: 6,
  },
  choiceDropdown: {
    gap: 6,
  },
  choiceOption: {
    backgroundColor: lume.colors.insetHighlight,
    borderColor: lume.colors.borderSubtleTop,
    borderRadius: lume.radius.sm,
    borderWidth: 1,
    minHeight: lume.controls.minTouchHeight,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceOptionActive: {
    backgroundColor: lume.colors.accentSubtle,
    borderColor: lume.colors.accentEdge,
  },
  choiceOptionPressed: {
    opacity: 0.85,
  },
  choiceOptionText: {
    ...textPreset,
    color: lume.colors.textSecondary,
    fontSize: 15,
  },
  choiceOptionTextActive: {
    color: lume.colors.accent,
    fontFamily: lume.fonts.structuralSemibold,
  },
  progressTrack: {
    borderRadius: lume.radius.pill,
    height: 10,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: lume.radius.pill,
    height: '100%',
  },
  progressIndeterminate: {
    height: '100%',
    width: '100%',
  },
  progressIndeterminateFill: {
    borderRadius: lume.radius.pill,
    height: '100%',
    width: '40%',
  },
  imageFrame: {
    borderRadius: lume.radius.md,
    overflow: 'hidden',
  },
  image: {
    aspectRatio: 16 / 9,
    width: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderRadius: lume.radius.md,
    justifyContent: 'center',
  },
  imageAlt: {
    ...mono,
    color: lume.colors.textTertiary,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  menubar: {
    gap: 4,
    paddingVertical: 2,
  },
  menubarItem: {
    borderRadius: lume.radius.sm,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  menubarItemPressed: {
    backgroundColor: lume.colors.insetHighlight,
  },
  menubarLabel: {
    ...textSecondary,
    color: lume.colors.textSecondary,
    fontFamily: lume.fonts.structuralSemibold,
    fontSize: 14,
  },
  tree: {
    gap: 1,
  },
  treeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 34,
    paddingRight: 8,
  },
  treeTwist: {
    color: lume.colors.textTertiary,
    fontSize: 12,
    width: 12,
  },
  treeLabel: {
    ...textPreset,
    color: lume.colors.text,
    fontSize: 14,
  },
  timeline: {
    borderRadius: lume.radius.md,
    gap: 8,
    padding: 12,
  },
  timelineTrack: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  timelineKind: {
    ...mono,
    color: lume.colors.textTertiary,
    fontSize: 11,
    textTransform: 'uppercase',
    width: 56,
  },
  timelineLane: {
    backgroundColor: lume.colors.insetHighlight,
    borderRadius: lume.radius.sm,
    flex: 1,
    height: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  timelinePlayhead: {
    backgroundColor: lume.colors.accent,
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 2,
  },
  vectorFrame: {
    alignItems: 'center',
    borderRadius: lume.radius.md,
    justifyContent: 'center',
    padding: 16,
  },
  vector: {
    aspectRatio: 1,
    width: '70%',
  },
  mediaShell: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderRadius: lume.radius.md,
    gap: 6,
    justifyContent: 'center',
  },
  mediaKind: {
    color: lume.colors.textSecondary,
    fontFamily: lume.fonts.structuralSemibold,
    fontSize: 15,
    textTransform: 'uppercase',
  },
  mediaMeta: {
    ...mono,
    color: lume.colors.textTertiary,
  },
  canvasRegion: {
    alignItems: 'center',
    borderRadius: lume.radius.md,
    justifyContent: 'center',
    maxHeight: 240,
    width: '100%',
  },
  canvasRegionMeta: {
    ...mono,
    color: lume.colors.textTertiary,
  },
  chartFrame: {
    borderRadius: lume.radius.md,
    padding: 14,
  },
  chartEmpty: {
    alignItems: 'center',
    borderRadius: lume.radius.md,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  chartEmptyNote: {
    ...mono,
    color: lume.colors.textTertiary,
  },
  chartBars: {
    gap: 8,
  },
  chartBarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  chartBarLabel: {
    ...mono,
    color: lume.colors.textSecondary,
    fontSize: 12,
    width: 64,
  },
  chartBarTrack: {
    backgroundColor: lume.colors.insetHighlight,
    borderRadius: lume.radius.sm,
    flex: 1,
    height: 16,
    overflow: 'hidden',
  },
  chartBarFill: {
    borderRadius: lume.radius.sm,
    height: '100%',
    minWidth: 2,
  },
  chartBarValue: {
    ...mono,
    color: lume.colors.text,
    fontSize: 12,
    textAlign: 'right',
    width: 56,
  },
  chartSvg: {
    aspectRatio: 640 / 260,
    width: '100%',
  },
  chartPieWrap: {
    alignItems: 'center',
    gap: 14,
  },
  chartPie: {
    height: 160,
    width: 160,
  },
  chartLegend: {
    alignSelf: 'stretch',
    gap: 6,
  },
  chartLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  chartLegendChip: {
    borderRadius: 3,
    height: 12,
    width: 12,
  },
  chartLegendLabel: {
    ...textPreset,
    color: lume.colors.textSecondary,
    flex: 1,
    fontSize: 13,
  },
  chartLegendValue: {
    ...mono,
    color: lume.colors.text,
    fontSize: 12,
  },
});

export default PrimitiveNode;
