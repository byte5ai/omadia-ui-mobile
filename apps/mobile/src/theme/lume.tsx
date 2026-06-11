import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type GradientStops = readonly [string, string];

export const lume = {
  colors: {
    accent: '#6fc8d6',
    accentActive: '#a1dce6',
    accentEdge: 'rgba(111,200,214,0.72)',
    accentGlow: 'rgba(111,200,214,0.32)',
    accentGlowCore: 'rgba(210,245,250,0.5)',
    accentGlowStrong: 'rgba(111,200,214,0.48)',
    accentHover: '#88d2de',
    accentSubtle: 'rgba(111,200,214,0.2)',
    borderBtm: 'rgba(0,0,0,0.5)',
    borderSubtleBtm: 'rgba(0,0,0,0.4)',
    borderSubtleTop: 'rgba(255,255,255,0.06)',
    borderTop: 'rgba(255,255,255,0.1)',
    errorEdge: '#c5685a',
    errorFg: '#e08577',
    insetHighlight: 'rgba(255,255,255,0.06)',
    loading: '#3e414c',
    loadingHi: '#525561',
    successFg: '#88c499',
    text: '#eeeff3',
    textDisabled: '#525561',
    textInverse: '#1f2127',
    textSecondary: '#b6b9c3',
    textTertiary: '#888b95',
    warningFg: '#d6b468',
  },
  fonts: {
    mono: 'GeistMono_400Regular',
    monoMedium: 'GeistMono_500Medium',
    prose: 'SourceSerif4_400Regular',
    structural: 'Geist_400Regular',
    structuralSemibold: 'Geist_600SemiBold',
  },
  gradients: {
    accentFill: ['#88d2de', '#6fc8d6'] as GradientStops,
    accentSubtle: ['#314149', '#27343a'] as GradientStops,
    bg: ['#232631', '#1b1d24'] as GradientStops,
    raised: ['#303440', '#292c37'] as GradientStops,
    sunken: ['#1d1f26', '#16181e'] as GradientStops,
    surface: ['#2a2d38', '#23262f'] as GradientStops,
  },
  controls: {
    minTouchHeight: 44,
  },
  radius: {
    lg: 12,
    md: 8,
    pill: 999,
    sm: 6,
  },
  spacing: {
    containerMargin: 12,
    containerPadding: 16,
    flowGap: 8,
    splitGap: 12,
    stackGap: 10,
  },
} as const;

export type SurfaceVariant = keyof typeof lume.gradients;

interface SurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant: SurfaceVariant;
}

const borderByVariant: Record<
  SurfaceVariant,
  { bottom: string; top: string }
> = {
  accentFill: {
    bottom: lume.colors.accent,
    top: 'rgba(255,255,255,0.18)',
  },
  accentSubtle: {
    bottom: lume.colors.accentEdge,
    top: 'rgba(255,255,255,0.14)',
  },
  bg: {
    bottom: lume.colors.borderSubtleBtm,
    top: lume.colors.borderSubtleTop,
  },
  raised: {
    bottom: lume.colors.borderBtm,
    top: lume.colors.borderTop,
  },
  sunken: {
    bottom: lume.colors.borderSubtleBtm,
    top: lume.colors.borderSubtleTop,
  },
  surface: {
    bottom: lume.colors.borderSubtleBtm,
    top: lume.colors.borderSubtleTop,
  },
};

/** Every Lume surface is a vertical top→bottom gradient (light from above). */
const gradientDirection = {
  end: { x: 0, y: 1 },
  start: { x: 0, y: 0 },
} as const;

export function Surface({
  children,
  style,
  variant,
}: SurfaceProps): React.JSX.Element {
  const border = borderByVariant[variant];

  return (
    <LinearGradient
      colors={[...lume.gradients[variant]] as const}
      end={gradientDirection.end}
      start={gradientDirection.start}
      style={[
        styles.surface,
        {
          borderColor: border.bottom,
          borderTopColor: border.top,
        },
        style,
      ]}
    >
      {variant === 'raised' ? (
        <View pointerEvents="none" style={styles.insetHighlight} />
      ) : null}
      {children}
    </LinearGradient>
  );
}

export const text: TextStyle = {
  color: lume.colors.text,
  fontFamily: lume.fonts.structural,
  fontSize: 15,
  lineHeight: 22,
};

export const textSecondary: TextStyle = {
  color: lume.colors.textSecondary,
  fontFamily: lume.fonts.structural,
  fontSize: 15,
  lineHeight: 22,
};

export const textTertiary: TextStyle = {
  color: lume.colors.textTertiary,
  fontFamily: lume.fonts.structural,
  fontSize: 13,
  lineHeight: 18,
};

export const mono: TextStyle = {
  color: lume.colors.textSecondary,
  fontFamily: lume.fonts.mono,
  fontSize: 13,
  lineHeight: 18,
};

export const prose: TextStyle = {
  color: lume.colors.text,
  fontFamily: lume.fonts.prose,
  fontSize: 16,
  lineHeight: 26,
};

export const heading: TextStyle = {
  color: lume.colors.text,
  fontFamily: lume.fonts.structuralSemibold,
  fontSize: 24,
  lineHeight: 30,
};

export const containerTitle: TextStyle = {
  color: lume.colors.textSecondary,
  fontFamily: lume.fonts.structural,
  fontSize: 12,
  letterSpacing: 1,
  lineHeight: 16,
  textTransform: 'uppercase',
};

const styles = StyleSheet.create({
  insetHighlight: {
    backgroundColor: lume.colors.insetHighlight,
    height: StyleSheet.hairlineWidth,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  surface: {
    borderRadius: lume.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
});
