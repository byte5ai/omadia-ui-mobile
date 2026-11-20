import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Surface, lume, textSecondary, textTertiary } from '../theme/lume';
import type { AgentDirectoryEntry, Speaker } from './protocol';
import { avatarSrc, initialsOf, type SystemNoticeView } from './speakerView';
import type { AgentTexts } from './texts';

/**
 * Agents in the UI (spec 2042 §5.3, INV-1/4): every agent shows as a name with
 * an avatar — in the picker, on its canvas and on every answer. Never a bare
 * "omadia". A `system` notice is set apart: no avatar, no agent name of its
 * own, its own label and frame, so it can never be read as an agent speaking.
 */

const AVATAR_SIZE = { sm: 24, md: 40 } as const;

interface AvatarProps {
  displayName: string;
  avatarUrl?: string | undefined;
  /** the connected server's ws(s) URL — resolves server-relative avatar paths */
  serverUrl?: string | undefined;
  size?: keyof typeof AVATAR_SIZE;
}

/** The agent's picture, or its initials when it has none or it cannot load. */
export function AgentAvatar({
  displayName,
  avatarUrl,
  serverUrl,
  size = 'md',
}: AvatarProps): React.JSX.Element {
  const dimension = AVATAR_SIZE[size];
  const src = avatarSrc(avatarUrl, serverUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== undefined && failedSrc !== src;
  const frame = { borderRadius: dimension / 2, height: dimension, width: dimension };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, frame]}
    >
      {showImage ? (
        <Image
          onError={() => setFailedSrc(src)}
          source={{ uri: src }}
          style={frame}
        />
      ) : (
        <Text style={[styles.avatarInitials, { fontSize: size === 'sm' ? 10 : 15 }]}>
          {initialsOf(displayName)}
        </Text>
      )}
    </View>
  );
}

/** Avatar and name of one agent, inline. */
export function AgentBadge({
  displayName,
  avatarUrl,
  serverUrl,
  size = 'sm',
}: AvatarProps): React.JSX.Element {
  return (
    <View style={styles.badge}>
      <AgentAvatar
        avatarUrl={avatarUrl}
        displayName={displayName}
        serverUrl={serverUrl}
        size={size}
      />
      <Text numberOfLines={1} style={styles.badgeName}>
        {displayName}
      </Text>
    </View>
  );
}

/**
 * Who an answer is from — shown with every answer of a canvas. The speaker is
 * the one the server stamped; a `system` speaker has no avatar and is shown by
 * the notice instead.
 */
export function AnswerSpeaker({
  speaker,
  serverUrl,
  texts,
}: {
  speaker: Speaker | null;
  serverUrl?: string | undefined;
  texts: AgentTexts;
}): React.JSX.Element | null {
  if (speaker?.kind !== 'agent') return null;
  return (
    <View accessibilityLabel={texts.answerFrom(speaker.displayName)} accessible style={styles.speaker}>
      <AgentBadge
        avatarUrl={speaker.avatarUrl}
        displayName={speaker.displayName}
        serverUrl={serverUrl}
      />
    </View>
  );
}

interface PickerProps {
  agents: readonly AgentDirectoryEntry[];
  /** false until the server's directory arrived: "nobody" is not yet "loading" */
  loaded: boolean;
  selectedId: string | undefined;
  serverUrl?: string | undefined;
  texts: AgentTexts;
  onSelect: (agent: AgentDirectoryEntry) => void;
}

/**
 * The agent of a conversation, chosen before the first turn. Only the agents
 * the server lists for this user are offered (availability is the server's);
 * the choice is fixed for the canvas once its first turn is sent.
 */
export function AgentPicker({
  agents,
  loaded,
  selectedId,
  serverUrl,
  texts,
  onSelect,
}: PickerProps): React.JSX.Element {
  if (!loaded) {
    return (
      <View accessibilityState={{ busy: true }} style={styles.pickerHint}>
        <Text style={textTertiary}>{texts.pickerLoading}</Text>
      </View>
    );
  }
  if (agents.length === 0) {
    return (
      <View accessibilityRole="alert" style={styles.pickerHint}>
        <Text style={textSecondary}>{texts.pickerEmpty}</Text>
      </View>
    );
  }
  return (
    <View accessibilityLabel={texts.pickerTitle} accessibilityRole="radiogroup" style={styles.picker}>
      <Text style={[textTertiary, styles.pickerTitle]}>{texts.pickerTitle}</Text>
      <ScrollView
        contentContainerStyle={styles.pickerRow}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {agents.map((agent) => {
          const selected = agent.id === selectedId;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={agent.id}
              onPress={() => onSelect(agent)}
              style={({ pressed }) => [styles.cardPressable, pressed ? styles.cardPressed : null]}
            >
              <Surface
                style={[styles.card, selected ? styles.cardSelected : null]}
                variant={selected ? 'accentSubtle' : 'raised'}
              >
                <AgentAvatar
                  avatarUrl={agent.avatarUrl}
                  displayName={agent.displayName}
                  serverUrl={serverUrl}
                />
                <View style={styles.cardText}>
                  <Text
                    numberOfLines={1}
                    style={[styles.cardName, selected ? styles.cardNameSelected : null]}
                  >
                    {agent.displayName}
                  </Text>
                  {agent.description !== undefined ? (
                    <Text numberOfLines={2} style={[textTertiary, styles.cardDescription]}>
                      {agent.description}
                    </Text>
                  ) : null}
                </View>
              </Surface>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * A `system` notice (INV-6/7): a message of the management layer — a refused
 * or failed turn, naming the agent it is about.
 */
export function SystemNotice({
  notice,
  texts,
  onDismiss,
}: {
  notice: SystemNoticeView | null;
  texts: AgentTexts;
  onDismiss?: () => void;
}): React.JSX.Element | null {
  if (notice === null) return null;
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <View style={styles.noticeBody}>
        <Text style={styles.noticeLabel}>{texts.systemNotice}</Text>
        <Text style={styles.noticeText}>{notice.text}</Text>
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityLabel={texts.dismiss}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}
          style={styles.noticeClose}
        >
          <Text style={styles.noticeCloseGlyph}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: lume.colors.accentSubtle,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    color: lume.colors.accent,
    fontFamily: lume.fonts.structuralSemibold,
  },
  badge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  badgeName: {
    color: lume.colors.text,
    flexShrink: 1,
    fontFamily: lume.fonts.structuralSemibold,
    fontSize: 14,
  },
  card: {
    alignItems: 'center',
    borderRadius: lume.radius.lg,
    flexDirection: 'row',
    gap: 10,
    minHeight: lume.controls.minTouchHeight,
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardName: {
    color: lume.colors.text,
    fontFamily: lume.fonts.structuralSemibold,
    fontSize: 15,
  },
  cardNameSelected: {
    color: lume.colors.accent,
  },
  cardPressable: {
    borderRadius: lume.radius.lg,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardSelected: {
    borderBottomColor: lume.colors.accent,
    borderColor: lume.colors.accentEdge,
    borderTopColor: '#ffffff52',
  },
  cardText: {
    flexShrink: 1,
    gap: 2,
  },
  notice: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(214,180,104,0.08)',
    borderColor: lume.colors.warningFg,
    borderLeftWidth: 3,
    borderRadius: lume.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  noticeBody: {
    flex: 1,
    gap: 4,
  },
  noticeClose: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
    minWidth: 24,
  },
  noticeCloseGlyph: {
    color: lume.colors.textSecondary,
    fontSize: 14,
  },
  noticeLabel: {
    color: lume.colors.warningFg,
    fontFamily: lume.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noticeText: {
    color: lume.colors.text,
    fontFamily: lume.fonts.structural,
    fontSize: 14,
    lineHeight: 20,
  },
  picker: {
    gap: 8,
    paddingTop: 12,
  },
  pickerHint: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerRow: {
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pickerTitle: {
    paddingHorizontal: 16,
  },
  speaker: {
    alignSelf: 'flex-start',
  },
});
