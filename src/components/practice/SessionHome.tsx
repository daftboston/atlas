import { useRouter } from 'expo-router';

import { Text, useThemeColor, View } from '@/components/Themed';
import { Group, PrimaryButton, SectionFooter, SectionHeader } from '@/components/ui/ios';
import { startDailySession, useSessionHome } from '@/state/sessionStore';
import { StyleSheet } from 'react-native';

export function SessionHome() {
  const { ready, home } = useSessionHome();
  const router = useRouter();
  const secondary = useThemeColor({}, 'secondaryText');
  const tint = useThemeColor({}, 'tint');
  if (!ready) return null;

  function open(sessionId: string) {
    router.push({ pathname: '/practice/[sessionId]', params: { sessionId } });
  }

  return (
    <View style={styles.block}>
      <SectionHeader>Today</SectionHeader>
      {home.activeSessionId ? (
        <PrimaryButton
          label="Resume"
          onPress={() => {
            if (home.activeSessionId) open(home.activeSessionId);
          }}
        />
      ) : home.caughtUp ? (
        <Group>
          <View style={styles.card}>
            <Text style={[styles.copy, { color: secondary }]}>All caught up</Text>
          </View>
        </Group>
      ) : (
        <>
          <Group>
            <View style={styles.card}>
              {home.dueCount > 0 ? <Text style={[styles.copy, styles.due, { color: tint }]}>{home.dueCount} due</Text> : null}
              {home.newRemaining > 0 ? (
                <Text style={styles.copy}>
                  {home.newRemaining} new {home.newRemaining === 1 ? 'phrase' : 'phrases'} left today
                </Text>
              ) : null}
            </View>
          </Group>
          <View style={styles.action}>
            <PrimaryButton
              label="Start session"
              onPress={() => {
                const result = startDailySession();
                if (result.kind !== 'caught-up') open(result.id);
              }}
            />
          </View>
        </>
      )}
      <SectionFooter>Hear a phrase, say it back, or type it. The microphone on this Mac is simulated.</SectionFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 0 },
  card: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  copy: { fontSize: 17, lineHeight: 22 },
  due: { fontWeight: '700' },
  action: { marginTop: 12 },
});