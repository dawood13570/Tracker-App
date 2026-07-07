// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'inline-import',
        {
          extensions: ['.sql'],
          rootPath: '.' // <--- Crucial for Windows: Tells the plugin to start searching from the project root folder
        }
      ]
    ],
  };
};