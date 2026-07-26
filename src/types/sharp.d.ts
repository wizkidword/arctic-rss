// sharp 0.35.0 exposes its runtime entry points but omits a `types` condition
// from its package `exports`. Next's TypeScript bundler therefore cannot reach
// the bundled declaration file even though it is present in the package.
type SharpModule = typeof import("../../node_modules/sharp/lib/index")

declare module "sharp" {
  const sharp: SharpModule

  export = sharp
}
