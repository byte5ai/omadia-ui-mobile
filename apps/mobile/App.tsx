import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  type AppStateStatus,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {
  applyServerMessage,
  type CanvasListEntry,
  initialCanvasState,
  type CanvasState,
  type ClientTurn,
  type ConnectionStatus,
  type ServerMessage,
} from '@omadia/canvas-core';
import { LinearGradient } from 'expo-linear-gradient';
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

import PrimitiveNode, { type PrimitiveJson } from './src/render/PrimitiveNode';
import {
  AsyncSessionPersistence,
  type AppSettings,
  SettingsStorage,
} from './src/storage';
import {
  createCanvasConnection,
  type CanvasConnection,
} from './src/connection';
import {
  discoverProviders,
  httpOriginFromWs,
  loginWithPassword,
} from './src/auth';
import {
  Surface,
  containerTitle,
  heading,
  lume,
  mono,
  prose,
  text as textPreset,
  textSecondary,
  textTertiary,
} from './src/theme/lume';

type Screen = 'url' | 'login' | 'canvas';

/** Prefilled connection target — mirrors the desktop onboarding default and the
 *  local test middleware (Docker omadia-test on :8080). */
const DEFAULT_WS_URL = 'ws://127.0.0.1:8080/omadia-ui/canvas';

const newTurnId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const reduceCanvasState = (
  state: CanvasState,
  message: ServerMessage,
): CanvasState => applyServerMessage(state, message).state;

const isPrimitiveNode = (value: unknown): value is PrimitiveJson =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PrimitiveJson).type === 'string';

const canvasColorHex = (color: number): string =>
  `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;

type PrimaryButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

function PrimaryButton({
  disabled = false,
  label,
  onPress,
  style,
  textStyle,
}: PrimaryButtonProps): React.JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        styles.primaryButtonShadow,
        disabled ? styles.disabledButton : null,
        pressed && !disabled ? styles.primaryButtonPressed : null,
        style,
      ]}
    >
      <LinearGradient
        colors={[...lume.gradients.accentFill] as const}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.primaryButtonFill}
      >
        <Text style={[textPreset, styles.primaryButtonLabel, textStyle]}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

export default function App(): React.JSX.Element {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    SourceSerif4_400Regular,
  });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<Screen>('url');
  const [urlInput, setUrlInput] = useState(DEFAULT_WS_URL);
  const [status, setStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
  });
  const [prompt, setPrompt] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // sign-in form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [providerId, setProviderId] = useState('local');

  const [canvasState, dispatchCanvasMessage] = useReducer(
    reduceCanvasState,
    initialCanvasState,
  );
  const [canvases, setCanvases] = useState<CanvasListEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [previewTree, setPreviewTree] = useState<unknown>(null);
  const [renderedSessionId, setRenderedSessionId] = useState<string | null>(null);

  const canvasStateRef = useRef(canvasState);
  const connectionRef = useRef<CanvasConnection | null>(null);
  const sessionRef = useRef(new AsyncSessionPersistence());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const cookieRef = useRef<string | undefined>(undefined);
  const statusRef = useRef<ConnectionStatus>(status);

  useEffect(() => {
    canvasStateRef.current = canvasState;
  }, [canvasState]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const openCanvas = useCallback((entry: CanvasListEntry) => {
    setActiveSessionId(entry.sessionId);
    setPreviewTree(entry.tree ?? null);
    connectionRef.current?.switchCanvas(entry.sessionId);
  }, []);

  useEffect(() => {
    if (activeSessionId === null && canvases.length > 0) {
      openCanvas(canvases[0]);
    }
  }, [activeSessionId, canvases, openCanvas]);

  const handleStatus = useCallback((nextStatus: ConnectionStatus) => {
    const wasReady = statusRef.current.state === 'ready';
    statusRef.current = nextStatus;
    console.log(
      `[canvas] status=${nextStatus.state}${nextStatus.detail ? ` detail=${nextStatus.detail}` : ''}`,
    );
    setStatus(nextStatus);

    if (!wasReady && nextStatus.state === 'ready') {
      connectionRef.current?.requestCanvasList();
    }
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    if (message.type === 'canvas_list') {
      setCanvases(message.canvases);
    }

    const result = applyServerMessage(canvasStateRef.current, message);
    canvasStateRef.current = result.state;
    dispatchCanvasMessage(message);

    if (
      message.type.startsWith('surface_') &&
      'canvasSessionId' in message &&
      typeof message.canvasSessionId === 'string'
    ) {
      setRenderedSessionId(message.canvasSessionId);
      if (isPrimitiveNode(result.state.tree)) {
        setPreviewTree(null);
      }
    }

    if (result.resync) {
      connectionRef.current?.resync();
    }
  }, []);

  const buildConnection = useCallback(
    (serverUrl: string): CanvasConnection =>
      createCanvasConnection(
        serverUrl,
        sessionRef.current,
        {
          onMessage: handleMessage,
          onStatus: handleStatus,
        },
        cookieRef.current,
      ),
    [handleMessage, handleStatus],
  );

  const connectToServer = useCallback(
    (serverUrl: string) => {
      connectionRef.current?.close();
      setCanvases([]);
      setActiveSessionId(null);
      setPreviewTree(null);
      setRenderedSessionId(null);
      const connection = buildConnection(serverUrl);
      connectionRef.current = connection;
      connection.connect();
      setScreen('canvas');
    },
    [buildConnection],
  );

  /** Decide whether the server needs a password login before connecting. */
  const prepare = useCallback(
    async (serverUrl: string) => {
      let origin: string;
      try {
        origin = httpOriginFromWs(serverUrl);
      } catch {
        connectToServer(serverUrl);
        return;
      }
      const discovery = await discoverProviders(origin);
      const passwordProvider = discovery?.providers.find((p) => p.kind === 'password');
      if (passwordProvider) {
        setProviderId(passwordProvider.id);
        setAuthError(null);
        setScreen('login');
      } else {
        // no auth (e.g. stub server) — connect straight through
        connectToServer(serverUrl);
      }
    },
    [connectToServer],
  );

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      const session = sessionRef.current;
      await session.hydrate();
      const loadedSettings = await SettingsStorage.load();

      if (!mounted) {
        return;
      }

      if (loadedSettings) {
        setSettings(loadedSettings);
        setUrlInput(loadedSettings.serverUrl);
        await prepare(loadedSettings.serverUrl);
      }

      setBooting(false);
    };

    void boot();

    return () => {
      mounted = false;
      connectionRef.current?.close();
    };
  }, [prepare]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        nextState === 'active' &&
        (previousState === 'background' || previousState === 'inactive')
      ) {
        connectionRef.current?.resync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleConnect = useCallback(async () => {
    const trimmedUrl = urlInput.trim();

    if (!trimmedUrl) {
      setValidationError('Enter a websocket URL.');
      return;
    }

    const nextSettings = { serverUrl: trimmedUrl };
    await SettingsStorage.save(nextSettings);
    setValidationError(null);
    setSettings(nextSettings);
    await prepare(trimmedUrl);
  }, [prepare, urlInput]);

  const handleLogin = useCallback(async () => {
    const serverUrl = settings?.serverUrl;
    if (!serverUrl) return;
    if (!email.trim() || !password) {
      setAuthError('E-Mail und Passwort eingeben.');
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      const cookie = await loginWithPassword(
        httpOriginFromWs(serverUrl),
        providerId,
        email,
        password,
      );
      cookieRef.current = cookie;
      console.log(`[auth] login ok, cookie acquired (provider=${providerId})`);
      setPassword('');
      connectToServer(serverUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login fehlgeschlagen.';
      console.log(`[auth] login failed: ${message}`);
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  }, [connectToServer, email, password, providerId, settings]);

  const handleSend = useCallback(() => {
    const text = prompt.trim();
    if (!text) {
      return;
    }

    const turn = {
      type: 'turn',
      turnId: newTurnId(),
      text,
    } satisfies ClientTurn;

    connectionRef.current?.sendTurn(turn);
    setPrompt('');
  }, [prompt]);

  const handleAction = useCallback((node: PrimitiveJson) => {
    const action = node.action;
    if (
      typeof action !== 'object' ||
      action === null ||
      typeof (action as { type?: unknown }).type !== 'string'
    ) {
      return;
    }

    const turn = {
      type: 'turn',
      turnId: newTurnId(),
      action: action as ClientTurn['action'],
    } satisfies ClientTurn;

    connectionRef.current?.sendTurn(turn);
  }, []);

  if (booting || !fontsLoaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Surface style={styles.flex} variant="bg">
          <View style={styles.centered}>
            <Text style={[textTertiary, styles.bootText]}>Loading canvas…</Text>
          </View>
        </Surface>
      </SafeAreaView>
    );
  }

  if (screen === 'url') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Surface style={styles.flex} variant="bg">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <View style={styles.onboarding}>
              <Surface style={styles.onboardingCard} variant="raised">
                <Text style={[heading, styles.heroTitle]}>Connect to Omadia Canvas</Text>
                <Text style={[textSecondary, styles.heroText]}>
                  Enter the websocket endpoint for your canvas session.
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onChangeText={(value) => {
                    setUrlInput(value);
                    if (validationError) {
                      setValidationError(null);
                    }
                  }}
                  placeholder="ws(s)://..."
                  placeholderTextColor={lume.colors.textTertiary}
                  style={[styles.input, styles.inputMono]}
                  value={urlInput}
                />
                {validationError ? (
                  <Text style={styles.errorText}>{validationError}</Text>
                ) : null}
                <PrimaryButton label="Connect" onPress={() => void handleConnect()} />
              </Surface>
            </View>
          </KeyboardAvoidingView>
        </Surface>
      </SafeAreaView>
    );
  }

  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Surface style={styles.flex} variant="bg">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <View style={styles.onboarding}>
              <Surface style={styles.onboardingCard} variant="raised">
                <Text style={[heading, styles.heroTitle]}>Anmelden</Text>
                <Text style={[mono, textTertiary, styles.heroText]}>
                  {settings?.serverUrl ?? ''}
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  onChangeText={(value) => {
                    setEmail(value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="E-Mail"
                  placeholderTextColor={lume.colors.textTertiary}
                  style={styles.input}
                  value={email}
                />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  textContentType="password"
                  onChangeText={(value) => {
                    setPassword(value);
                    if (authError) setAuthError(null);
                  }}
                  onSubmitEditing={() => void handleLogin()}
                  placeholder="Passwort"
                  placeholderTextColor={lume.colors.textTertiary}
                  style={styles.input}
                  value={password}
                />
                {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
                <PrimaryButton
                  disabled={authBusy}
                  label={authBusy ? 'Anmelden…' : 'Sign in'}
                  onPress={() => void handleLogin()}
                />
                <Pressable onPress={() => setScreen('url')} style={styles.linkButton}>
                  {({ pressed }) => (
                    <Text
                      style={[
                        textSecondary,
                        styles.linkText,
                        pressed ? styles.linkTextPressed : null,
                      ]}
                    >
                      ← Server ändern
                    </Text>
                  )}
                </Pressable>
              </Surface>
            </View>
          </KeyboardAvoidingView>
        </Surface>
      </SafeAreaView>
    );
  }

  const liveTree =
    activeSessionId !== null &&
    renderedSessionId === activeSessionId &&
    isPrimitiveNode(canvasState.tree)
      ? canvasState.tree
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Surface style={styles.flex} variant="bg">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.screen}>
            <View style={styles.header}>
              <Text style={[containerTitle, styles.headerTitle]}>Omadia Canvas</Text>
              <Text style={[mono, textTertiary, styles.statusLine]}>
                {status.state}
                {status.detail ? ` · ${status.detail}` : ''}
              </Text>
              {canvasState.turnError ? (
                <Text style={styles.errorText}>{canvasState.turnError}</Text>
              ) : null}
              {canvasState.notices.length > 0 ? (
                <Text style={[mono, textTertiary, styles.noticeText]}>
                  {canvasState.notices.join(' · ')}
                </Text>
              ) : null}
            </View>

            {canvases.length > 0 ? (
              <ScrollView
                contentContainerStyle={styles.canvasSwitcherContent}
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={styles.canvasSwitcher}
              >
                {canvases.map((entry) => {
                  const active = entry.sessionId === activeSessionId;
                  return (
                    <Pressable
                      key={entry.sessionId}
                      onPress={() => openCanvas(entry)}
                      style={({ pressed }) => [
                        styles.canvasChipPressable,
                        pressed ? styles.canvasChipPressed : null,
                      ]}
                    >
                      <Surface
                        style={[
                          styles.canvasChip,
                          active ? styles.canvasChipActive : null,
                        ]}
                        variant="raised"
                      >
                        <View
                          style={[
                            styles.canvasChipDot,
                            { backgroundColor: canvasColorHex(entry.color) },
                          ]}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            mono,
                            styles.canvasChipLabel,
                            active ? styles.canvasChipLabelActive : null,
                          ]}
                        >
                          {entry.title}
                        </Text>
                      </Surface>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <ScrollView
              contentContainerStyle={styles.canvasContent}
              keyboardShouldPersistTaps="handled"
              style={styles.canvasScroll}
            >
              {liveTree ? (
                <PrimitiveNode node={liveTree} onAction={handleAction} />
              ) : isPrimitiveNode(previewTree) ? (
                <PrimitiveNode node={previewTree} onAction={handleAction} />
              ) : (
                <Surface style={styles.placeholder} variant="raised">
                  <Text style={[containerTitle, styles.placeholderTitle]}>
                    Waiting for canvas…
                  </Text>
                  <Text style={[textSecondary, styles.placeholderText]}>
                    Send a prompt or wait for the server to push the first tree.
                  </Text>
                </Surface>
              )}
              {canvasState.prose ? (
                <Surface style={styles.proseCard} variant="raised">
                  <Text style={[mono, textTertiary, styles.proseLabel]}>Prose</Text>
                  <Text style={[prose, styles.proseText]}>{canvasState.prose}</Text>
                </Surface>
              ) : null}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                autoCapitalize="sentences"
                multiline
                onChangeText={setPrompt}
                placeholder="Describe the next change..."
                placeholderTextColor={lume.colors.textTertiary}
                style={styles.composerInput}
                value={prompt}
              />
              <PrimaryButton
                disabled={!prompt.trim() || status.state !== 'ready'}
                label={canvasState.turnPending ? 'Sending…' : 'Send'}
                onPress={handleSend}
                style={styles.composerButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bootText: {
    fontSize: 16,
  },
  canvasContent: {
    gap: 16,
    padding: 16,
  },
  canvasChip: {
    alignItems: 'center',
    backgroundColor: '#303440',
    borderBottomColor: lume.colors.borderBtm,
    borderColor: lume.colors.borderBtm,
    borderRadius: 999,
    borderWidth: 1,
    borderTopColor: lume.colors.borderTop,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  canvasChipActive: {
    backgroundColor: lume.colors.accentSubtle,
    borderColor: lume.colors.accent,
    borderTopColor: '#ffffff66',
  },
  canvasChipDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  canvasChipLabel: {
    color: lume.colors.textSecondary,
    fontSize: 14,
    fontFamily: lume.fonts.monoMedium,
    maxWidth: 180,
  },
  canvasChipLabelActive: {
    color: lume.colors.accent,
  },
  canvasChipPressable: {
    borderRadius: 999,
  },
  canvasChipPressed: {
    opacity: 0.85,
  },
  canvasScroll: {
    flex: 1,
  },
  canvasSwitcher: {
    borderBottomColor: lume.colors.borderSubtleBtm,
    borderBottomWidth: 1,
    maxHeight: 62,
  },
  canvasSwitcherContent: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  composer: {
    borderTopColor: lume.colors.borderSubtleTop,
    borderTopWidth: 1,
    gap: 12,
    padding: 16,
  },
  composerButton: {
    alignSelf: 'flex-end',
    minWidth: 120,
  },
  composerInput: {
    backgroundColor: '#303440',
    borderBottomColor: lume.colors.borderBtm,
    borderColor: lume.colors.borderBtm,
    borderRadius: lume.radius.sm,
    borderWidth: 1,
    borderTopColor: lume.colors.borderTop,
    color: lume.colors.text,
    fontFamily: lume.fonts.structural,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  disabledButton: {
    opacity: 0.7,
  },
  errorText: {
    color: lume.colors.errorFg,
    fontSize: 13,
  },
  flex: {
    flex: 1,
  },
  header: {
    borderBottomColor: lume.colors.borderSubtleBtm,
    borderBottomWidth: 1,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: lume.colors.text,
    fontSize: 20,
    fontFamily: lume.fonts.structuralSemibold,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
  },
  heroTitle: {
    color: lume.colors.text,
    fontSize: 28,
    fontFamily: lume.fonts.structuralSemibold,
  },
  input: {
    backgroundColor: '#303440',
    borderBottomColor: lume.colors.borderBtm,
    borderColor: lume.colors.borderBtm,
    borderRadius: lume.radius.sm,
    borderWidth: 1,
    borderTopColor: lume.colors.borderTop,
    color: lume.colors.text,
    fontFamily: lume.fonts.structural,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMono: {
    fontFamily: lume.fonts.mono,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: lume.colors.textSecondary,
    fontSize: 14,
    fontFamily: lume.fonts.structuralSemibold,
  },
  linkTextPressed: {
    color: lume.colors.accent,
  },
  noticeText: {
    fontSize: 13,
  },
  onboarding: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  onboardingCard: {
    borderRadius: lume.radius.lg,
    elevation: Platform.OS === 'android' ? 8 : 0,
    gap: 14,
    padding: 26,
    shadowColor: lume.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  placeholder: {
    alignItems: 'center',
    borderRadius: lume.radius.lg,
    gap: 8,
    padding: 24,
  },
  placeholderText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  placeholderTitle: {
    color: lume.colors.text,
    fontSize: 18,
    fontFamily: lume.fonts.structuralSemibold,
  },
  primaryButton: {
    borderRadius: lume.radius.md,
  },
  primaryButtonFill: {
    alignItems: 'center',
    borderBottomColor: lume.colors.accent,
    borderRadius: lume.radius.md,
    borderTopColor: '#ffffff66',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    color: lume.colors.textInverse,
    fontSize: 15,
    fontFamily: lume.fonts.structuralSemibold,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonShadow: {
    elevation: Platform.OS === 'android' ? 6 : 0,
    shadowColor: lume.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  proseCard: {
    borderRadius: lume.radius.md,
    gap: 8,
    padding: 14,
  },
  proseLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  proseText: {
    color: lume.colors.text,
    fontSize: 15,
    fontFamily: lume.fonts.prose,
    lineHeight: 22,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  statusLine: {
    fontSize: 13,
  },
});
