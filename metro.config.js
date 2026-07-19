const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. Tell Metro to recognize .sql files as source code extensions
config.resolver.sourceExts.push('sql');

// 2. Intercept compilation with our text-to-string transformer
config.transformer.babelTransformerPath = require.resolve('./transformer.js');

module.exports = config;