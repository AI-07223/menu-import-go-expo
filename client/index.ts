import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
if (process.env.EXPO_PUBLIC_RECORDED_DEMO === "1" && typeof window !== "undefined" && window.location.pathname === "/" && !new URLSearchParams(window.location.search).has("classic")) {
  window.location.replace("/kitchen/");
} else {
  registerRootComponent(App);
}
