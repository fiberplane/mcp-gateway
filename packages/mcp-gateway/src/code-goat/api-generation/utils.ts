export function toCamelCase(str: string) {
  return str
    .replace(/[_-]([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase()); // Keep first letter lowercase for camelCase
}

export function toPascalCase(str: string) {
  return str
    .replace(/[_-]([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/^[a-z]/, (letter) => letter.toUpperCase()); // Capitalize first letter for PascalCase
}
