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
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  applyServerMessage,
  initialCanvasState,
  type CanvasState,
  type ClientTurn,
  type ConnectionStatus,
  type ServerMessage,
} from '@omadia/canvas-core';

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
  fetchProviders,
  httpOriginFromWs,
  loginWithPassword,
} from './src/auth';

type Screen = 'url' | 'login' | 'canvas';

const palette = {
  bg: '#0f1115',
  surface: '#1a1d24',
  border: '#2a2f3a',
  text: '#e6e8eb',
  muted: '#9aa3af',
  accent: '#4f8cff',
};

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

export default function App(): React.JSX.Element {
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

  const canvasStateRef = useRef(canvasState);
  const connectionRef = useRef<CanvasConnection | null>(null);
  const sessionRef = useRef(new AsyncSessionPersistence());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const cookieRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    canvasStateRef.current = canvasState;
  }, [canvasState]);

  const handleStatus = useCallback((nextStatus: ConnectionStatus) => {
    setStatus(nextStatus);
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    const result = applyServerMessage(canvasStateRef.current, message);
    canvasStateRef.current = result.state;
    dispatchCanvasMessage(message);

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
      const providers = await fetchProviders(origin);
      const passwordProvider = providers?.find((p) => p.kind === 'password');
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
      setPassword('');
      connectToServer(serverUrl);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login fehlgeschlagen.');
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

  if (booting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.bootText}>Loading canvas…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'url') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.onboarding}>
            <Text style={styles.heroTitle}>Connect to Omadia Canvas</Text>
            <Text style={styles.heroText}>
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
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={urlInput}
            />
            {validationError ? (
              <Text style={styles.errorText}>{validationError}</Text>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={() => void handleConnect()}>
              <Text style={styles.primaryButtonLabel}>Connect</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.onboarding}>
            <Text style={styles.heroTitle}>Anmelden</Text>
            <Text style={styles.heroText}>
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
              placeholderTextColor={palette.muted}
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
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={password}
            />
            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
            <Pressable
              disabled={authBusy}
              style={({ pressed }) => [
                styles.primaryButton,
                authBusy && styles.disabledButton,
                pressed && !authBusy ? styles.primaryButtonPressed : null,
              ]}
              onPress={() => void handleLogin()}
            >
              <Text style={styles.primaryButtonLabel}>
                {authBusy ? 'Anmelden…' : 'Sign in'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setScreen('url')}>
              <Text style={styles.linkText}>← Server ändern</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Omadia Canvas</Text>
            <Text style={styles.statusLine}>
              {status.state}
              {status.detail ? ` · ${status.detail}` : ''}
            </Text>
            {canvasState.turnError ? (
              <Text style={styles.errorText}>{canvasState.turnError}</Text>
            ) : null}
            {canvasState.notices.length > 0 ? (
              <Text style={styles.noticeText}>{canvasState.notices.join(' · ')}</Text>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.canvasContent}
            keyboardShouldPersistTaps="handled"
            style={styles.canvasScroll}
          >
            {isPrimitiveNode(canvasState.tree) ? (
              <PrimitiveNode node={canvasState.tree} onAction={handleAction} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderTitle}>Waiting for canvas…</Text>
                <Text style={styles.placeholderText}>
                  Send a prompt or wait for the server to push the first tree.
                </Text>
              </View>
            )}
            {canvasState.prose ? (
              <View style={styles.proseCard}>
                <Text style={styles.proseLabel}>Prose</Text>
                <Text style={styles.proseText}>{canvasState.prose}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              autoCapitalize="sentences"
              multiline
              onChangeText={setPrompt}
              placeholder="Describe the next change..."
              placeholderTextColor={palette.muted}
              style={styles.composerInput}
              value={prompt}
            />
            <Pressable
              disabled={!prompt.trim() || status.state !== 'ready'}
              onPress={handleSend}
              style={({ pressed }) => [
                styles.primaryButton,
                (!prompt.trim() || status.state !== 'ready') && styles.disabledButton,
                pressed && prompt.trim() && status.state === 'ready'
                  ? styles.primaryButtonPressed
                  : null,
              ]}
            >
              <Text style={styles.primaryButtonLabel}>
                {canvasState.turnPending ? 'Sending…' : 'Send'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bootText: {
    color: palette.muted,
    fontSize: 16,
  },
  canvasContent: {
    gap: 16,
    padding: 16,
  },
  canvasScroll: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  composer: {
    backgroundColor: palette.surface,
    borderTopColor: palette.border,
    borderTopWidth: 1,
    gap: 12,
    padding: 16,
  },
  composerInput: {
    backgroundColor: palette.bg,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    color: palette.text,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: '#ff7d7d',
    fontSize: 13,
  },
  flex: {
    flex: 1,
  },
  header: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
  },
  heroText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
  },
  input: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  linkText: {
    color: palette.accent,
    fontSize: 14,
    paddingVertical: 8,
    textAlign: 'center',
  },
  noticeText: {
    color: palette.muted,
    fontSize: 13,
  },
  onboarding: {
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    padding: 24,
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  placeholderText: {
    color: palette.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  placeholderTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  proseCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  proseLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  proseText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  safeArea: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  screen: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  statusLine: {
    color: palette.muted,
    fontSize: 13,
  },
});
