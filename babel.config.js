module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // No "inline-import" plugin needed!
    plugins: [], 
  };
};