import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function HabitScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Daily habit
      </Text>
      <Text style={styles.copy}>
        A finished session can earn a few free minutes. Screen Time is coming later, so for now Atlas shows a timer.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={() => router.push('/(onboarding)/done')} style={styles.primary}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          Next
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={() => router.push('/(onboarding)/done')} style={styles.secondary}>
        <Text style={styles.secondaryText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700' },
  copy: { fontSize: 18, lineHeight: 26 },
  primary: { backgroundColor: '#2f95dc', borderRadius: 8, alignItems: 'center', paddingVertical: 14 },
  primaryText: { fontSize: 17, fontWeight: '600' },
  secondary: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: { fontSize: 16 },
});
