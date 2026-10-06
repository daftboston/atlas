// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle's Expo SQLite guide: let Metro resolve the .sql migration files that
// src/data/migrations/migrations.js imports (babel-plugin-inline-import inlines them).
config.resolver.sourceExts.push('sql');

module.exports = config;
