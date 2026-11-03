import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test-utils';
import LogSessionScreen from '@/app/log-session';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

describe('FR1: log session form (#4 preview)', () => {
  it('asks for an RPE when it is missing, as in the "Missing RPE" design', async () => {
    await renderScreen(<LogSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: '60' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save session' }));

    expect(screen.getByText('Choose an RPE from 1 to 10.')).toBeTruthy();
  });

  it('shows session load from the analytics engine: RPE 7 × 60 min = 420 AU', async () => {
    await renderScreen(<LogSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: '60' }));
    await fireEvent.press(screen.getByRole('radio', { name: '7' }));

    expect(screen.getByText('420 AU')).toBeTruthy();
    expect(screen.getByText('7: Very hard')).toBeTruthy();
  });

  it('says plainly that a valid session is not saved yet', async () => {
    await renderScreen(<LogSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: '45' }));
    await fireEvent.press(screen.getByRole('radio', { name: '5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save session' }));

    expect(screen.getByText('Preview: this session is valid but was not saved.')).toBeTruthy();
  });
});
