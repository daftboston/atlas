import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useReviewHome } from '@/state/reviewStore';
import { completeOnboarding } from '@/state/settingsStore';

export default function DoneScreen() {
  const router = useRouter();
  const review = useReviewHome();
  const scheduled = review.ready ? review.home.due.length + review.home.upcoming.length : 0;

  function finish() {
    completeOnboarding();
    router.replace('/(tabs)/learn');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        You&apos;re ready
      </Text>
      <Text style={styles.copy}>
        {scheduled === 0
          ? 'Your next session will put the first reviews on the schedule.'
          : `${scheduled} ${scheduled === 1 ? 'review is' : 'reviews are'} on the schedule.`}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Go to Learn" onPress={finish} style={styles.primary}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          Go to Learn
        </Text>
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
});