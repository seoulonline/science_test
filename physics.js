/** Ideal steady DC: source E, shared R1, parallel R2 and switched R3. */
export function solve({ voltage, r1, r2, r3, closed = true }) {
  if (![voltage, r1, r2, r3].every(Number.isFinite) || voltage < 0 || Math.min(r1, r2, r3) <= 0) {
    throw new RangeError('유한한 전압과 양의 저항을 입력하세요.');
  }
  const parallel = closed ? (r2 * r3) / (r2 + r3) : r2;
  const total = r1 + parallel;
  const i1 = voltage / total;
  const branchVoltage = i1 * parallel;
  const i2 = branchVoltage / r2;
  const i3 = closed ? branchVoltage / r3 : 0;
  const v1 = i1 * r1;
  return { total, parallel, i1, i2, i3, v1, branchVoltage, sourcePower: voltage * i1,
    resistorPower: i1 * i1 * r1 + i2 * i2 * r2 + i3 * i3 * r3,
    kclResidual: i1 - i2 - i3, kvlResidual: voltage - v1 - branchVoltage };
}
export function loopChanges(state, branch = 'r2', reverse = false) {
  const s = solve(state);
  if (branch === 'r3' && !state.closed) return null;
  return reverse ? [s.branchVoltage, s.v1, -state.voltage] : [state.voltage, -s.v1, -s.branchVoltage];
}
