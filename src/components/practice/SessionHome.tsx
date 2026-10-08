import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { startDailySession, useSessionHome } from '@/state/sessionStore';

export function SessionHome() {
  const { ready, home } = useSessionHome();
  const router = useRouter();
  if (!ready) return null;

  function open(sessionId: string) {
    router.push({ pathname: '/practice/[sessionId]', params: { sessionId } });
  }

  return (
    <View style={styles.bar}>
      {home.activeSessionId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Resume"
          onPress={() => {
            if (home.activeSessionId) open(home.activeSessionId);
          }}
          style={styles.primary}>
          <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
            Resume
          </Text>
        </Pressable>
      ) : home.caughtUp ? (
        <Text style={styles.copy}>All caught up</Text>
      ) : (
        <>
          {home.dueCount > 0 ? (
            <Text style={styles.copy}>
              {home.dueCount} due
            </Text>
          ) : null}
          {home.newRemaining > 0 ? (
            <Text style={styles.copy}>
              {home.newRemaining} new {home.newRemaining === 1 ? 'phrase' : 'phrases'} left today
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start session"
            onPress={() => {
              const result = startDailySession();
              if (result.kind !== 'caught-up') open(result.id);
            }}
            style={styles.primary}>
            <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
              Start session
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
  },
  primary: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
