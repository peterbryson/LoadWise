import { localIsoDate } from './dates';

describe('FR1: the day a log belongs to (#5)', () => {
  it("uses the phone's own calendar date, late in the evening", () => {
    expect(localIsoDate(new Date(2026, 10, 20, 23, 59))).toBe('2026-11-20');
  });

  it('uses the phone\'s own calendar date, just after midnight', () => {
    expect(localIsoDate(new Date(2026, 10, 21, 0, 1))).toBe('2026-11-21');
  });

  it('pads single-digit months and days', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });
});
