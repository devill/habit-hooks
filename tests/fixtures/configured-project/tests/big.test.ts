// A test file that, without the default exclude, would trip max-lines-per-function.
export function huge(): number {
  let total = 0;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  return total;
}
