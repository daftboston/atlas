/**
 * Apple system colors from the Human Interface Guidelines:
 * system background, grouped background, label, secondary label, separator,
 * and system blue / green / orange / red.
 */
const tintLight = '#007AFF';
const tintDark = '#0A84FF';

export default {
  light: {
    text: '#000000',
    secondaryText: '#3C3C4399',
    background: '#F2F2F7',
    card: '#FFFFFF',
    fill: '#E5E5EA',
    separator: '#3C3C434A',
    tint: tintLight,
    danger: '#FF3B30',
    success: '#248A3D',
    warning: '#C93400',
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintLight,
  },
  dark: {
    text: '#FFFFFF',
    secondaryText: '#EBEBF599',
    background: '#000000',
    card: '#1C1C1E',
    fill: '#2C2C2E',
    separator: '#545458A6',
    tint: tintDark,
    danger: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintDark,
  },
};
