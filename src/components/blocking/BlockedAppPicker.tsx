import { Pressable, ScrollView, StyleSheet, Switch } from 'react-native';

import { AppIcon } from '@/components/blocking/AppIcon';
import { Text, useThemeColor } from '@/components/Themed';
import { Group, SectionFooter } from '@/components/ui/ios';
import { DEMO_APPS } from '@/domain/blocking/apps';
import { DEMO_LABEL } from '@/services/screenTime/demo';
import { setBlockedApps, useBlocking } from '@/state/blockingStore';

/** The "Blocked apps" picker (blocking demo). On a device this is replaced by the system Screen Time picker. */
export function BlockedAppPicker() {
  const { ready, apps } = useBlocking();
  const tint = useThemeColor({}, 'tint');
  const separator = useThemeColor({}, 'separator');
  const secondary = useThemeColor({}, 'secondaryText');
  const chosen = new Set(apps.map((app) => app.id));

  function toggle(id: string, on: boolean) {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    setBlockedApps([...next]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={[styles.demo, { color: secondary }]}>{DEMO_LABEL}</Text>
      <Text style={styles.copy}>Choose the apps Atlas locks until you practice.</Text>
      {ready ? (
        <Group>
          {DEMO_APPS.map((app) => {
            const on = chosen.has(app.id);
            return (
              <Pressable
                key={app.id}
                accessibilityRole="switch"
                accessibilityLabel={`Block ${app.name}`}
                accessibilityState={{ checked: on }}
                onPress={() => toggle(app.id, !on)}
                style={styles.row}>
                <AppIcon app={app} />
                <Text style={styles.name}>{app.name}</Text>
                <Switch
                  value={on}
                  onValueChange={(value) => toggle(app.id, value)}
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  trackColor={{ true: tint, false: separator }}
                />
              </Pressable>
            );
          })}
        </Group>
      ) : (
        <Text style={[styles.copy, { color: secondary }]}>Loading…</Text>
      )}
      <SectionFooter>
        {chosen.size === 0 ? 'Nothing is blocked yet.' : `${chosen.size} ${chosen.size === 1 ? 'app is' : 'apps are'} blocked. Open the Unlock tab to try opening one.`}
      </SectionFooter>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 64 },
  demo: { fontSize: 15, fontWeight: '600' },
  copy: { fontSize: 17, lineHeight: 22 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  name: { flex: 1, fontSize: 17 },
});
