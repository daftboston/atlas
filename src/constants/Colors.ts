/**
 * Graphite and silver. A quiet, Apple-like field with one calm accent.
 * The background is a soft vertical gradient (see src/components/ui/Wash.tsx): near-black graphite in dark mode,
 * off-white silver in light mode. Glass surfaces sit on it and pick up its tone.
 * Tide is the action color. Coral marks the phrase being learned.
 *
 * Contrast (WCAG 2.x, worst case over the gradient and the card on it), enforced by src/constants/Colors.test.ts:
 * text and secondaryText, tint, accent, danger, success and warning are all at least 4.5:1 as text in both modes.
 */
const tideLight = '#066A70';
const tideDark = '#5EE0D6';
const coralLight = '#A53809';
const coralDark = '#FF8B6A';

const palette = {
  light: {
    text: '#111114',
    secondaryText: '#4A4B52',
    background: '#EDEDF1',
    card: '#FFFFFFCC',
    fill: '#FFFFFFA6',
    glass: '#FFFFFF38',
    separator: '#3C3C434D',
    tint: tideLight,
    accent: coralLight,
    danger: '#B3231A',
    success: '#17703C',
    warning: '#A8430C',
    tabIconDefault: '#6B6C73',
    tabIconSelected: tideLight,
    wash: '#EDEDF1',
    washTop: '#F7F7F9',
    washMid: '#EDEDF1',
    washBottom: '#DFE0E6',
    sheen: 'rgba(255, 255, 255, 0.7)',
  },
  dark: {
    text: '#F5F5F7',
    secondaryText: '#A8A9B0',
    background: '#0F1012',
    card: '#2A2B30CC',
    fill: '#2A2B30A6',
    glass: '#FFFFFF1F',
    separator: '#FFFFFF33',
    tint: tideDark,
    accent: coralDark,
    danger: '#FF6B63',
    success: '#3DDB86',
    warning: '#FFB086',
    tabIconDefault: '#8D8E95',
    tabIconSelected: tideDark,
    wash: '#0F1012',
    washTop: '#1A1B1E',
    washMid: '#0F1012',
    washBottom: '#050506',
    sheen: 'rgba(255, 255, 255, 0.07)',
  },
};

export default palette;
