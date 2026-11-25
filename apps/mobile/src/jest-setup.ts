import * as ReactNative from 'react-native';

// Jest's 5 s timeout starts with each test body. react-native loads each component the first time
// it is used, and on a cold Jest cache (every CI job) Babel transforms it then. On a small CI
// runner that pushed the first test to render past 5 s (pipeline 8156), and the act() it left open
// broke the tests after it. Loading the components the app uses here, before any test starts, keeps
// that one-off cost out of the tests' timing. Add a component here when the app starts using it.
const usedComponents = [
  'ActivityIndicator',
  'AppState',
  'Pressable',
  'ScrollView',
  'StyleSheet',
  'Switch',
  'Text',
  'TextInput',
  'View',
  'useColorScheme',
] as const;

for (const name of usedComponents) void ReactNative[name];

// The first native view to render (Switch, expo-image's Image) makes react-native's renderer load
// its private interface, about 50 more modules, in the same lazy way. Reading each of its getters
// loads them now. If a react-native upgrade moves this file, every suite fails here, not at random.
const rendererInterface = jest.requireActual<Record<string, unknown>>(
  'react-native/Libraries/ReactPrivate/ReactNativePrivateInterface',
);
for (const name of Object.keys(rendererInterface)) void rendererInterface[name];
