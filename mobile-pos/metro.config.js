const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const androidBuildExclusions = [
  /android[\\/]app[\\/]build[\\/].*/,
  /android[\\/]\.gradle[\\/].*/,
  /android[\\/]app[\\/]\.cxx[\\/].*/,
  /android[\\/]build[\\/].*/,
];

// After `expo prebuild`, native build trees are huge and can break Metro's watcher on Windows.
const existingBlockList = config.resolver?.blockList;
config.resolver = {
  ...config.resolver,
  blockList: Array.isArray(existingBlockList)
    ? [...existingBlockList, ...androidBuildExclusions]
    : existingBlockList
      ? [existingBlockList, ...androidBuildExclusions]
      : androidBuildExclusions,
};

config.watcher = {
  ...config.watcher,
  healthCheck: {
    enabled: true,
    interval: 10000,
    timeout: 120000,
  },
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Avoid patching Metro's file map before the watcher is ready (fixes getSha1 crash).
  forceWriteFileSystem: true,
});
