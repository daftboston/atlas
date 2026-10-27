import { SymbolView } from 'expo-symbols';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, useThemeColor, View } from '@/components/Themed';
import { GlassSurface } from '@/components/ui/Glass';

type Press = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Visible title when it differs from the accessibility label. */
  title?: string;
};

export function usePalette() {
  return {
    text: useThemeColor({}, 'text'),
    secondary: useThemeColor({}, 'secondaryText'),
    card: useThemeColor({}, 'card'),
    fill: useThemeColor({}, 'fill'),
    tint: useThemeColor({}, 'tint'),
    accent: useThemeColor({}, 'accent'),
    danger: useThemeColor({}, 'danger'),
    separator: useThemeColor({}, 'separator'),
    background: useThemeColor({}, 'background'),
    glass: useThemeColor({}, 'glass'),
  };
}

export function PrimaryButton({ label, title, onPress, disabled }: Press) {
  const tint = useThemeColor({}, 'tint');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, pressed && styles.pressed, disabled && styles.disabled]}>
      <GlassSurface glassEffectStyle="clear" isInteractive={!disabled} tintColor={tint} fallbackColor={tint} style={styles.primaryGlass}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#071418">
          {title ?? label}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

export function SecondaryButton({ label, title, onPress, disabled }: Press) {
  const text = useThemeColor({}, 'text');
  const glass = useThemeColor({}, 'glass');
  const fill = useThemeColor({}, 'fill');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed, disabled && styles.disabled]}>
      <GlassSurface glassEffectStyle="clear" isInteractive={!disabled} tintColor={glass} fallbackColor={fill} style={styles.secondaryGlass}>
        <Text style={[styles.buttonText, { color: text }]}>{title ?? label}</Text>
      </GlassSurface>
    </Pressable>
  );
}

export function TextButton({
  label,
  title,
  onPress,
  destructive,
}: {
  label: string;
  /** Visible title when it differs from the accessibility label. */
  title?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.textButton}>
      <Text style={[styles.buttonText, { color: destructive ? danger : tint }]}>{title ?? label}</Text>
    </Pressable>
  );
}

export function SectionHeader({ children }: { children: string }) {
  const color = useThemeColor({}, 'accent');
  return (
    <Text style={[styles.header, { color }]} accessibilityLabel={children}>
      {children}
    </Text>
  );
}

export function SectionFooter({ children }: { children: string }) {
  const color = useThemeColor({}, 'secondaryText');
  return <Text style={[styles.footer, { color }]}>{children}</Text>;
}

export function Group({ children }: { children: ReactNode }) {
  const card = useThemeColor({}, 'card');
  const glass = useThemeColor({}, 'glass');
  const separator = useThemeColor({}, 'separator');
  const items = Children.toArray(children);
  return (
    <GlassSurface glassEffectStyle="clear" tintColor={glass} fallbackColor={card} style={styles.group}>
      {items.map((child, index) => (
        <Fragment key={index}>
          {child}
          {index < items.length - 1 ? <View style={[styles.separator, { backgroundColor: separator }]} /> : null}
        </Fragment>
      ))}
    </GlassSurface>
  );
}

export function ChoiceRow({
  label,
  accessibilityLabel,
  selected,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const tint = useThemeColor({}, 'tint');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {selected ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={tint} size={17} /> : null}
    </Pressable>
  );
}

export function StepperRow({
  label,
  value,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
  canDecrease,
  canIncrease,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
  canDecrease: boolean;
  canIncrease: boolean;
}) {
  const tint = useThemeColor({}, 'tint');
  const fill = useThemeColor({}, 'fill');
  const glass = useThemeColor({}, 'glass');
  const separator = useThemeColor({}, 'separator');
  const secondary = useThemeColor({}, 'secondaryText');
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.stepValue, { color: secondary }]}>{value}</Text>
      <GlassSurface glassEffectStyle="clear" tintColor={glass} fallbackColor={fill} style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          disabled={!canDecrease}
          hitSlop={stepHit}
          onPress={onDecrease}
          style={[styles.step, !canDecrease && styles.disabled]}>
          <Text style={[styles.stepGlyph, { color: tint }]}>−</Text>
        </Pressable>
        <View style={[styles.stepRule, { backgroundColor: separator }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
          disabled={!canIncrease}
          hitSlop={stepHit}
          onPress={onIncrease}
          style={[styles.step, !canIncrease && styles.disabled]}>
          <Text style={[styles.stepGlyph, { color: tint }]}>+</Text>
        </Pressable>
      </GlassSurface>
    </View>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  const text = useThemeColor({}, 'text');
  const fill = useThemeColor({}, 'fill');
  const glass = useThemeColor({}, 'glass');
  const secondary = useThemeColor({}, 'secondaryText');
  return (
    <GlassSurface glassEffectStyle="clear" tintColor={glass} fallbackColor={fill} style={styles.fieldShell}>
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={secondary}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.field, { color: text }, style]}
        {...rest}
      />
    </GlassSurface>
  );
}

export function ScreenTitle({ children }: { children: string }) {
  const accent = useThemeColor({}, 'accent');
  return (
    <View style={styles.titleRow}>
      <View style={[styles.titleMark, { backgroundColor: accent }]} />
      <Text style={styles.largeTitle} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

export function OnboardingFrame({
  title,
  copy,
  children,
  footer,
}: {
  title: string;
  copy: string;
  children?: ReactNode;
  footer: ReactNode;
}) {
  const secondary = useThemeColor({}, 'secondaryText');
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.onboarding, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Scrolls so large Dynamic Type sizes never push the footer buttons off the screen. */}
      <ScrollView style={styles.onboardingScroll} contentContainerStyle={styles.onboardingBody} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{title}</ScreenTitle>
        <Text style={[styles.body, { color: secondary }]}>{copy}</Text>
        {children}
      </ScrollView>
      <View style={styles.onboardingFooter}>{footer}</View>
    </View>
  );
}

const stepHit = { top: 10, bottom: 10, left: 8, right: 8 };

const styles = StyleSheet.create({
  primary: { borderRadius: 22 },
  primaryGlass: {
    minHeight: 50,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: { fontSize: 17, fontWeight: '600' },
  secondary: { borderRadius: 22 },
  secondaryGlass: {
    minHeight: 50,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
  header: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginBottom: 6,
  },
  footer: { fontSize: 13, lineHeight: 18, marginHorizontal: 16, marginTop: 8 },
  group: { borderRadius: 26, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleMark: { width: 8, height: 28, borderRadius: 4 },
  row: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: { fontSize: 17, flex: 1, flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, overflow: 'hidden' },
  step: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  stepGlyph: { fontSize: 20, lineHeight: 22, fontWeight: '500' },
  stepValue: { minWidth: 24, textAlign: 'right', fontSize: 17, fontVariant: ['tabular-nums'] },
  fieldShell: { borderRadius: 18, overflow: 'hidden' },
  field: {
    minHeight: 44,
    paddingHorizontal: 16,
    fontSize: 17,
    backgroundColor: 'transparent',
  },
  onboarding: { flex: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  onboardingScroll: { flex: 1 },
  onboardingBody: { gap: 12, paddingBottom: 12 },
  onboardingFooter: { gap: 8 },
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.4 },
  body: { fontSize: 17, lineHeight: 22 },
});
