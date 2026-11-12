// Monorepo: appen bruker @skodd/core rett fra kilden, så pris-, sesong- og
// slitasjelogikken er den samme i appen som i API-et.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const prosjekt = __dirname;
const rot = path.resolve(prosjekt, '../..');
const kjerne = path.resolve(rot, 'packages/core');

const config = getDefaultConfig(prosjekt);

config.watchFolders = [kjerne];
config.resolver.nodeModulesPaths = [
  path.resolve(prosjekt, 'node_modules'),
  path.resolve(rot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@skodd/core': kjerne,
};
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
