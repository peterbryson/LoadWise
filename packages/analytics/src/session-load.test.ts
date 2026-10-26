import { sessionLoad } from './session-load';

// Tests are named by requirement ID so results trace back to FR/NFRs (dissertation Ch6).
describe('FR2: session load = session-RPE × duration', () => {
  it('matches a hand-calculated fixture (RPE 7 × 60 min = 420 AU)', () => {
    expect(sessionLoad(7, 60)).toBe(420);
  });

  it('accepts the boundaries of the RPE scale', () => {
    expect(sessionLoad(1, 30)).toBe(30);
    expect(sessionLoad(10, 30)).toBe(300);
  });

  it.each([0, 11, 6.5, NaN])('rejects out-of-range or non-integer RPE %p', (rpe) => {
    expect(() => sessionLoad(rpe, 60)).toThrow(RangeError);
  });

  it.each([0, -10, Infinity])('rejects non-positive or non-finite duration %p', (minutes) => {
    expect(() => sessionLoad(5, minutes)).toThrow(RangeError);
  });
});
