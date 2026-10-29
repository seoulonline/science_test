/** Steady discharge DC: EMF E, internal r, external R1 and parallel R2/R3. */
export function solve({ voltage, r1, r2, r3, closed = true, internalR = 0 }) {
  if (![voltage, r1, r2, r3, internalR].every(Number.isFinite) || voltage < 0 || internalR < 0 || Math.min(r1, r2, r3) <= 0) {
    throw new RangeError('유한한 기전력, 0 이상의 내부 저항, 양의 외부 저항을 입력하세요.');
  }
  const parallel = closed ? (r2 * r3) / (r2 + r3) : r2;
  const externalResistance = r1 + parallel;
  const total = internalR + externalResistance;
  const i1 = voltage / total;
  const internalDrop = i1 * internalR;
  const terminalVoltage = voltage - internalDrop;
  const branchVoltage = i1 * parallel;
  const i2 = branchVoltage / r2;
  const i3 = closed ? branchVoltage / r3 : 0;
  const v1 = i1 * r1;
  const resistorPower = i1 * i1 * r1 + i2 * i2 * r2 + i3 * i3 * r3;
  const internalPower = i1 * i1 * internalR;
  return { total, parallel, externalResistance, i1, i2, i3, v1, branchVoltage, internalDrop, terminalVoltage,
    sourcePower: voltage * i1, resistorPower, internalPower, totalDissipation: resistorPower + internalPower,
    kclResidual: i1 - i2 - i3, kvlResidual: voltage - internalDrop - v1 - branchVoltage };
}
export function loopChanges(state, branch = 'r2', reverse = false) {
  const s = solve(state);
  if (branch === 'r3' && state.closed === false) return null;
  const forward = [state.voltage, ...(state.internalR > 0 ? [-s.internalDrop] : []), -s.v1, -s.branchVoltage];
  return reverse ? forward.slice().reverse().map(value => -value) : forward;
}
