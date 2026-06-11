import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type PrimitiveJson = { type: string; [key: string]: unknown };

interface PrimitiveNodeProps {
  node: PrimitiveJson;
  onAction?: (node: PrimitiveJson) => void;
}

const palette = {
  bg: '#0f1115',
  surface: '#1a1d24',
  border: '#2a2f3a',
  text: '#e6e8eb',
  muted: '#9aa3af',
  accent: '#4f8cff',
};

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
  const sizes = [26, 24, 21, 18, 16, 14];
  return sizes[clamped - 1];
};

export function PrimitiveNode({
  node,
  onAction = noop,
}: PrimitiveNodeProps): React.JSX.Element | null {
  switch (node.type) {
    case 'container': {
      const title = getString(node.title);
      const children = getNodeArray(node.children);

      return (
        <View style={styles.container}>
          {title ? <Text style={styles.containerTitle}>{title}</Text> : null}
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
    case 'pane': {
      const title = getString(node.title);
      const container = isPrimitiveNode(node.container) ? node.container : null;
      const children = getNodeArray(node.children);

      return (
        <View style={styles.pane}>
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
        </View>
      );
    }
    case 'tabs':
      return <TabsNode node={node} onAction={onAction} />;
    case 'heading': {
      const content = getString(node.content) ?? '';
      const size = getHeadingSize(getNumber(node.level) ?? 2);

      return <Text style={[styles.heading, { fontSize: size }]}>{content}</Text>;
    }
    case 'text':
      return <Text style={styles.text}>{getString(node.content) ?? ''}</Text>;
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
        <Pressable style={styles.button} onPress={() => onAction(node)}>
          <Text style={styles.buttonLabel}>{label}</Text>
        </Pressable>
      );
    }
    case 'status':
      return (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{getString(node.text) ?? ''}</Text>
        </View>
      );
    case 'divider':
      return <View style={styles.divider} />;
    default:
      return <Text style={styles.fallback}>{node.type}</Text>;
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

    return node.tabs.flatMap((tab) => {
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
      <View style={styles.tabRow}>
        {tabs.map((tab, index) => {
          const active = index === clampedIndex;

          return (
            <Pressable
              key={`${tab.label}-${index}`}
              style={[styles.tabButton, active ? styles.tabButtonActive : null]}
              onPress={() => setActiveIndex(index)}
            >
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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

    return node.columns.flatMap((column) => {
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

    return node.rows.flatMap((row) => {
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
    <ScrollView horizontal style={styles.tableScroll} contentContainerStyle={styles.table}>
      <View>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {columns.map((column) => (
            <View key={column.fieldKey} style={[styles.tableCell, styles.tableHeaderCell]}>
              <Text style={styles.tableHeaderText}>{column.label}</Text>
            </View>
          ))}
        </View>
        {rows.map((row) => (
          <View key={row.rowKey} style={styles.tableRow}>
            {columns.map((column) => (
              <View key={column.fieldKey} style={styles.tableCell}>
                <Text style={styles.tableCellText}>
                  {String(row.cells[column.fieldKey] ?? '')}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ListNode({ node }: { node: PrimitiveJson }): React.JSX.Element {
  const items = useMemo(() => {
    if (!Array.isArray(node.items)) {
      return [];
    }

    return node.items.flatMap((item) => {
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
        },
      ];
    });
  }, [node.items]);

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Text key={item.itemKey} style={styles.listItem}>
          {`\u2022 ${item.label ?? item.itemKey}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  container: {
    gap: 12,
  },
  containerTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    backgroundColor: palette.border,
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  fallback: {
    color: palette.muted,
    fontSize: 13,
  },
  heading: {
    color: palette.text,
    fontWeight: '700',
  },
  list: {
    gap: 6,
  },
  listItem: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  pane: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  paneTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabButton: {
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  tabLabel: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: palette.text,
  },
  tabPanel: {
    marginTop: 12,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  table: {
    paddingBottom: 4,
  },
  tableCell: {
    borderBottomWidth: 1,
    borderColor: palette.border,
    minWidth: 120,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tableCellText: {
    color: palette.text,
    fontSize: 13,
  },
  tableHeaderCell: {
    backgroundColor: palette.surface,
  },
  tableHeaderRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  tableHeaderText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableScroll: {
    maxWidth: '100%',
  },
  tabsWrap: {
    marginVertical: 4,
  },
  text: {
    color: palette.text,
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
