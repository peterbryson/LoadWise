import { whatEachRoleSees } from './data-access';

describe('NFR2: what athletes are told each role sees (#3, #11)', () => {
  it('describes the need-to-know matrix the API enforces, role by role', () => {
    expect(whatEachRoleSees()).toEqual([
      {
        role: 'COACH',
        text: 'Coach: weekly load and ACWR, flags and their reasons, whether your wellness is below your usual',
      },
      {
        role: 'SC_COACH',
        text:
          'S&C coach: weekly load and ACWR, monotony and strain, flags and their reasons, ' +
          'whether your wellness is below your usual, your wellness scores',
      },
      {
        role: 'PHYSIO',
        text:
          'Physio: weekly load and ACWR, monotony and strain, flags and their reasons, ' +
          'whether your wellness is below your usual, your wellness scores, injury records',
      },
    ]);
  });

  it('never tells an athlete that a coach or S&C coach sees injury records', () => {
    const [coach, sc] = whatEachRoleSees();
    expect(coach.text).not.toMatch(/injury/);
    expect(sc.text).not.toMatch(/injury/);
  });
});
