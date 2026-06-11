/** DEV-only preview harness: renders the primitive gallery through the real
 *  PrimitiveNode renderer with the production Lume chrome, no server/login, so
 *  every module can be judged in the simulator. Not shipped. */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Geist_400Regular,
  Geist_600SemiBold,
} from '@expo-google-fonts/geist';
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
} from '@expo-google-fonts/geist-mono';
import { SourceSerif4_400Regular } from '@expo-google-fonts/source-serif-4';

import PrimitiveNode, { type PrimitiveJson } from '../render/PrimitiveNode';
import { lume, Surface } from '../theme/lume';
import { galleryTree } from './galleryFixture';

export default function GalleryApp(): React.JSX.Element {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    SourceSerif4_400Regular,
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={{ color: lume.colors.textTertiary }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Surface style={styles.flex} variant="bg">
        <ScrollView contentContainerStyle={styles.content}>
          <PrimitiveNode node={galleryTree as PrimitiveJson} />
        </ScrollView>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: 14, padding: 16, paddingBottom: 48 },
  flex: { flex: 1 },
  safeArea: { backgroundColor: lume.gradients.bg[1], flex: 1 },
});
