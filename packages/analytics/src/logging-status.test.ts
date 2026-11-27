import { loggingStatus } from './logging-status';

// Wednesday 25 Nov 2026 is "today" in every case; each expected value is read off the dates by hand.
const TODAY = '2026-11-25';
const on = (...dates: string[]) => dates.map((date) => ({ date }));

describe('FR4 #50: checked in today (AC1)', () => {
  it('is yes when there is a check-in dated today', () => {
    expect(loggingStatus([], on('2026-11-24', TODAY), TODAY).checkedInToday).toBe(true);
  });

  it('is no when the latest check-in was yesterday (boundary)', () => {
    expect(loggingStatus([], on('2026-11-23', '2026-11-24'), TODAY).checkedInToday).toBe(false);
  });

  it('is no for a check-in dated tomorrow, as the overview never counts future days (I-21)', () => {
    expect(loggingStatus([], on('2026-11-26'), TODAY).checkedInToday).toBe(false);
  });

  it('is no when the athlete has never checked in', () => {
    expect(loggingStatus([], [], TODAY).checkedInToday).toBe(false);
  });
});

describe('FR4 #50: date of the last session (AC1)', () => {
  it('is the latest session on or before today, whatever order the sessions arrive in', () => {
    expect(loggingStatus(on('2026-11-20', '2026-11-24', '2026-11-22'), [], TODAY).lastSessionDate).toBe('2026-11-24');
  });

  it('is today when a session was logged today (boundary)', () => {
    expect(loggingStatus(on('2026-11-24', TODAY, TODAY), [], TODAY).lastSessionDate).toBe(TODAY);
  });

  it('is null when no session has ever been logged', () => {
    expect(loggingStatus([], on(TODAY), TODAY).lastSessionDate).toBeNull();
  });

  it('ignores a session dated after today', () => {
    expect(loggingStatus(on('2026-11-26'), [], TODAY).lastSessionDate).toBeNull();
    expect(loggingStatus(on('2026-11-21', '2026-11-26'), [], TODAY).lastSessionDate).toBe('2026-11-21');
  });

  it('works across a month and year boundary', () => {
    expect(loggingStatus(on('2025-12-31', '2026-01-01'), [], '2026-01-02').lastSessionDate).toBe('2026-01-01');
  });
});

describe('FR4 #50: invalid input', () => {
  it('rejects an impossible date rather than guessing', () => {
    expect(() => loggingStatus(on('2026-02-30'), [], TODAY)).toThrow(RangeError);
    expect(() => loggingStatus([], on('25/11/2026'), TODAY)).toThrow(RangeError);
    expect(() => loggingStatus([], [], 'today')).toThrow(RangeError);
  });
});
