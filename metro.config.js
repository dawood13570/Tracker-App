const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');

config.resolver.assetExts.push('wasm');

config.transformer.babelTransformerPath = require.resolve('./transformer.js');

module.exports = config;