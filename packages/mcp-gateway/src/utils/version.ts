import packageJson from "../../package.json" with { type: "json" };

export function getVersion(): string {
  // In compiled binaries: use BUILD_VERSION injected via --define flag
  // @ts-expect-error - BUILD_VERSION is defined by --define flag during binary build
  if (typeof BUILD_VERSION !== "undefined") {
    // @ts-expect-error - BUILD_VERSION is defined by --define flag during binary build
    return BUILD_VERSION;
  }

  // In development: read from package.json
  return packageJson.version;
}
