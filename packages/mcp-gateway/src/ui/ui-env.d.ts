// Let TypeScript know that CSS files imported with { type: "text" } are strings

declare module "*.css" {
  const css: string;
  export default css;
}
