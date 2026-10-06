module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle's Expo SQLite guide: bundle the drizzle-kit .sql migrations as strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
