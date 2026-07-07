// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add the 'sql' extension to the existing list of source code formats Metro reads
config.resolver.sourceExts.push('sql'); 

module.exports = config;