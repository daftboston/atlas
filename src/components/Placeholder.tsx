import { Link, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

type Props = {
  title: string;
  /** What this screen will do once it is built (architecture §3). */
  purpose: string;
  next?: { href: Href; label: string };
};

// Honest stand-in for a route from architecture §3 that is not built yet.
export function Placeholder({ title, purpose, next }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.copy}>{purpose}</Text>
      <Text style={styles.status}>Not built yet. This screen is a placeholder.</Text>
      {next ? (
        <Link href={next.href} style={styles.link} accessibilityRole="link">
          {next.label}
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
  },
  status: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.6,
  },
  link: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#2f95dc',
  },
});
