import { registerRootComponent } from 'expo';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import App from './App';
// DEV preview — TEMP: render the primitive gallery to judge modules. Revert.
import GalleryApp from './src/dev/GalleryApp';

const PREVIEW = false;
const RootComponent = PREVIEW ? GalleryApp : App;

// Wrap in SafeAreaProvider so the app can read real device insets (notch /
// Dynamic Island / home indicator) via useSafeAreaInsets.
function Root(): React.JSX.Element {
  return React.createElement(SafeAreaProvider, null, React.createElement(RootComponent));
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
