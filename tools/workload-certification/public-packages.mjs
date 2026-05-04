export const PUBLIC_PACKAGES = [
  '@blue-quickjs/abi-manifest',
  '@blue-quickjs/dv',
  '@blue-quickjs/execution-profiles',
  '@blue-quickjs/quickjs-wasm-constants',
  '@blue-quickjs/quickjs-wasm',
  '@blue-quickjs/quickjs-runtime',
  '@blue-quickjs/deterministic-bundler',
  '@blue-quickjs/deterministic-builder',
];

export const PUBLIC_PACKAGE_PROJECTS = PUBLIC_PACKAGES.map((packageName) =>
  packageName.replace('@blue-quickjs/', ''),
);
