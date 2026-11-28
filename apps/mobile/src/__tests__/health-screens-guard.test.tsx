import { screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

// #48 AC2: the root layout wraps the user's own health screens in Stack.Protected, guarded by
// health-data consent. This checks the guard behaves as the layout relies on, with a small
// in-memory route tree in the same shape (the real root layout also loads fonts and Firebase).
function routes(consentGiven: boolean) {
  return {
    _layout: () => (
      <Stack>
        <Stack.Screen name="index" />
        <Stack.Protected guard={consentGiven}>
          <Stack.Screen name="wellness" />
        </Stack.Protected>
      </Stack>
    ),
    index: () => <Text>home</Text>,
    wellness: () => <Text>wellness form</Text>,
  };
}

describe('NFR2 #48 AC2: health screens need health-data consent', () => {
  it('does not open the wellness form by link without consent', async () => {
    await renderRouter(routes(false), { initialUrl: '/wellness' });

    expect(screen.queryByText('wellness form')).toBeNull();
    expect(screen.getByText('home')).toBeTruthy();
  });

  it('opens the wellness form with consent', async () => {
    await renderRouter(routes(true), { initialUrl: '/wellness' });

    expect(screen.getByText('wellness form')).toBeTruthy();
  });
});
