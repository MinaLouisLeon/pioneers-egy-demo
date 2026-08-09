const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

/**
 * Metro configuration for the monorepo.
 *
 * Expo SDK 52+ detects a workspace and sets watchFolders / nodeModulesPaths on
 * its own, so most of this is already handled. Two things still need saying
 * explicitly:
 *
 *  - `disableHierarchicalLookup: false` keeps the default resolution walk,
 *    which is what lets apps/mobile resolve a dependency hoisted to the
 *    workspace root.
 *  - The workspace packages ship raw TypeScript with no build step, so Metro
 *    must treat them as source. That happens automatically once the root is
 *    watched, but the explicit watchFolders entry documents the dependency and
 *    protects against a future Expo default changing under us.
 */
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = false;

module.exports = config;
