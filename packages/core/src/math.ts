export function between(x: number | null | undefined, min: number, max: number, included: boolean = false) {
  if (typeof x !== 'number') {
    return false
  }
  return included ? x >= min && x <= max : x > min && x < max
}
