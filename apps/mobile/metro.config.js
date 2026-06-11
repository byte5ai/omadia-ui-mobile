// Metro config for the bun-workspace: bundle @omadia/canvas-core from source
// (TypeScript, NodeNext-style ".js" import specifiers) without a build step.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1) Watch the whole monorepo so canvas-core source changes trigger rebundles.
config.watchFolders = [workspaceRoot];

// 2) Resolve hoisted + package-local node_modules (bun symlinks the workspace).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;

// 3) Allow .mjs (the precompiled ajv validators) as a source extension.
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// 4) canvas-core imports its own modules with a NodeNext ".js" extension that
//    points at ".ts" source. Metro resolves specifiers literally, so strip a
//    trailing ".js" from relative specifiers and retry against the TS source;
//    fall back to the default resolver (which still handles real .js/.mjs).
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = baseResolveRequest ?? context.resolveRequest;
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -'.js'.length), platform);
    } catch {
      // not a .ts source — fall through to the literal .js/.mjs resolution
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
