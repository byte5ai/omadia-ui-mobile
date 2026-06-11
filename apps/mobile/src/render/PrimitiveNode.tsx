import React, { useMemo, useState } from 'react';
import {
  Pressable,
  type PressableStateCallbackType,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  lume,
  Surface,
  text as textPreset,
  textSecondary,
  mono,
  heading,
  containerTitle,
} from '../theme/lume';

export type PrimitiveJson = { type: string; [key: string]: unknown };

interface PrimitiveNodeProps {
  node: PrimitiveJson;
  onAction?: (node: PrimitiveJson) => void;
}

const noop = () => {};

const isPrimitiveNode = (value: unknown): value is PrimitiveJson =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PrimitiveJson).type === 'string';

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const getNodeArray = (value: unknown): PrimitiveJson[] =>
  Array.isArray(value) ? value.filter(isPrimitiveNode) : [];

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

      return (
        <Pressable
          style={({ pressed }: PressableStateCallbackType) => [
            styles.buttonPressable,
            pressed ? styles.buttonPressablePressed : null,
          ]}
          onPress={() => onAction(node)}
        >
          <Surface variant="raised" style={styles.buttonSurface}>
            <Text style={styles.buttonLabel}>{label}</Text>
          </Surface>
        </Pressable>
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
  onAction: (node: PrimitiveJson) => void;
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
});

export default PrimitiveNode;
