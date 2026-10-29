import Colors from '@/constants/Colors';

type Rgb = [number, number, number];

function parse(color: string): { rgb: Rgb; alpha: number } {
  const hex = color.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  return { rgb, alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
}

function luminance([r, g, b]: Rgb) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function over(color: string, base: Rgb): Rgb {
  const { rgb, alpha } = parse(color);
  return rgb.map((c, i) => Math.round(c * alpha + base[i] * (1 - alpha))) as Rgb;
}

const TEXT_TOKENS = ['text', 'secondaryText', 'tint', 'accent', 'danger', 'success', 'warning'] as const;

describe.each(['light', 'dark'] as const)('%s palette', (mode) => {
  const palette = Colors[mode];
  const field = [palette.washTop, palette.washMid, palette.washBottom].map((color) => parse(color).rgb);
  // Text sits on the gradient itself or on the translucent card over it.
  const surfaces = [...field, ...field.map((base) => over(palette.card, base)), ...field.map((base) => over(palette.fill, base))];

  it.each(TEXT_TOKENS)('%s is at least 4.5:1 (WCAG AA) on every surface', (token) => {
    const text = parse(palette[token]).rgb;
    for (const surface of surfaces) expect(ratio(text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the field monochrome: no hue in the gradient stops', () => {
    for (const [r, g, b] of field) expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(8);
  });

  it('has no leftover orb tokens', () => {
    expect(Object.keys(palette).filter((key) => key.startsWith('orb'))).toEqual([]);
  });
});

it('primary buttons are readable: white on the light tint, near-black on the dark tint', () => {
  expect(ratio([255, 255, 255], parse(Colors.light.tint).rgb)).toBeGreaterThanOrEqual(4.5);
  expect(ratio([7, 20, 24], parse(Colors.dark.tint).rgb)).toBeGreaterThanOrEqual(4.5);
});
