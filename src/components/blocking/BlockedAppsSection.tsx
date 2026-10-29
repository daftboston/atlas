import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppIcon } from '@/components/blocking/AppIcon';
import { useBlockingClock } from '@/components/blocking/useBlockingClock';
import { Text, useThemeColor, View } from '@/components/Themed';
import { Group, SectionFooter, SectionHeader, TextButton } from '@/components/ui/ios';
import { formatCountdown, lockLabel } from '@/domain/blocking/lockMachine';
import { DEMO_LABEL } from '@/services/screenTime/demo';

/** "Blocked apps" on the Unlock tab (blocking demo, docs/architecture.md §7.1): each chosen app, its lock state, and Try opening. */
export function BlockedAppsSection() {
  const router = useRouter();
  const { ready, apps, now } = useBlockingClock();
  const secondary = useThemeColor({}, 'secondaryText');
  if (!ready) return null;

  const choose = <TextButton label="Choose apps to block" title={apps.length === 0 ? 'Choose apps' : 'Change apps'} onPress={() => router.push('/blocked/picker')} />;

  return (
    <View style={styles.block}>
      <SectionHeader>Blocked apps</SectionHeader>
      <Group>
        {apps.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.copy, { color: secondary }]}>No apps chosen yet. Pick the apps Atlas should lock.</Text>
          </View>
        ) : (
          apps.map((app) => {
            const remaining = app.state === 'unlocked' && app.unlockedUntil !== null ? formatCountdown(app.unlockedUntil - now) : null;
            const status = lockLabel(app.state, remaining);
            return (
              <View key={app.id} style={styles.row}>
                <AppIcon app={app} />
                <View style={styles.text} accessible accessibilityLabel={`${app.name}, ${status}`}>
                  <Text style={styles.name}>{app.name}</Text>
                  <Text style={[styles.status, { color: secondary }]}>{status}</Text>
                </View>
                <TextButton label={`Try opening ${app.name}`} title="Try opening" onPress={() => router.push({ pathname: '/blocked/[appId]', params: { appId: app.id } })} />
              </View>
            );
          })
        )}
        {choose}
      </Group>
      <SectionFooter>{DEMO_LABEL}</SectionFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 0, marginTop: 8 },
  empty: { paddingHorizontal: 16, paddingVertical: 12 },
  copy: { fontSize: 17, lineHeight: 22 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  status: { fontSize: 15, fontVariant: ['tabular-nums'] },
});
