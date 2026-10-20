/**
 * Harbor. Atlas is a coast, not a system-gray settings app.
 * Tide is the action color. Coral marks the phrase being learned.
 * Sand, foam, and dusk sit behind the glass so it has color to bend.
 * Ink is the reading color. Light and dark each keep their own orbs.
 */
const tideLight = '#0B7C82';
const tideDark = '#5EE0D6';
const coralLight = '#E15A3A';
const coralDark = '#FF8B6A';

const palette = {
  light: {
    text: '#14262C',
    secondaryText: '#3E5C64',
    background: '#D7F1EE',
    card: '#FFFFFFCC',
    fill: '#FFFFFFA6',
    glass: '#FFFFFF38',
    separator: '#0B7C8233',
    tint: tideLight,
    accent: coralLight,
    danger: '#D23B2F',
    success: '#1B7F45',
    warning: '#C4511A',
    tabIconDefault: '#5C787E',
    tabIconSelected: tideLight,
    wash: '#D7F1EE',
    orbTide: '#7EDDD4',
    orbSand: '#F6D7B0',
    orbCoral: '#F7B5A0',
    orbDusk: '#D4C2F4',
  },
  dark: {
    text: '#F3FBFA',
    secondaryText: '#A9C6CB',
    background: '#071418',
    card: '#12343ACC',
    fill: '#12343AA6',
    glass: '#FFFFFF22',
    separator: '#5EE0D640',
    tint: tideDark,
    accent: coralDark,
    danger: '#FF6B63',
    success: '#3DDB86',
    warning: '#FFB086',
    tabIconDefault: '#7E9AA0',
    tabIconSelected: tideDark,
    wash: '#071418',
    orbTide: '#0E6A72',
    orbSand: '#8A5A32',
    orbCoral: '#A33B32',
    orbDusk: '#3A2A62',
  },
};

export default palette;
