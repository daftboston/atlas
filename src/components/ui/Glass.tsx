import type { ComponentType, ReactNode } from 'react';
import { Platform, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

type GlassStyleName = 'clear' | 'regular' | 'none';

type SurfaceProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tintColor?: ColorValue;
  glassEffectStyle?: GlassStyleName;
  /** Lens response on press. Use it for controls, not for cards that contain controls. */
  isInteractive?: boolean;
  /** Painted when liquid glass is unavailable, including tests. */
  fallbackColor?: ColorValue;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
};

type NativeGlass = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  tintColor?: ColorValue;
  glassEffectStyle?: GlassStyleName;
  isInteractive?: boolean;
  pointerEvents?: SurfaceProps['pointerEvents'];
};

type NativeContainer = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  spacing?: number;
};

type GlassModule = {
  GlassView: ComponentType<NativeGlass>;
  GlassContainer: ComponentType<NativeContainer>;
  isLiquidGlassAvailable: () => boolean;
};

function loadGlass(): GlassModule | null {
  // The native view manager throws in Jest, and the effect is iOS 26+ only.
  if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') return null;
  if (Platform.OS !== 'ios') return null;
  try {
    // A static import loads the native view manager and crashes Jest.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-glass-effect') as GlassModule;
    if (!mod.isLiquidGlassAvailable()) return null;
    return mod;
  } catch {
    return null;
  }
}

const glass = loadGlass();

export function GlassSurface({
  children,
  style,
  tintColor,
  glassEffectStyle = 'regular',
  isInteractive = false,
  fallbackColor,
  pointerEvents,
}: SurfaceProps) {
  if (!glass) {
    return (
      <View pointerEvents={pointerEvents} style={[style, fallbackColor != null ? { backgroundColor: fallbackColor } : null]}>
        {children}
      </View>
    );
  }

  const Surface = glass.GlassView;
  return (
    <Surface
      pointerEvents={pointerEvents}
      style={style}
      tintColor={tintColor}
      glassEffectStyle={glassEffectStyle}
      isInteractive={isInteractive}>
      {children}
    </Surface>
  );
}

/** Nearby glass controls blend into each other inside this container. */
export function GlassCluster({ children, style, spacing = 18 }: { children: ReactNode; style?: StyleProp<ViewStyle>; spacing?: number }) {
  if (!glass) {
    return <View style={style}>{children}</View>;
  }
  const Cluster = glass.GlassContainer;
  return (
    <Cluster spacing={spacing} style={style}>
      {children}
    </Cluster>
  );
}
