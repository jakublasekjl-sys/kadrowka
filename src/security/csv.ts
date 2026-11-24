export function safeCsvCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}
