import { Linking, Pressable, StyleSheet } from 'react-native';

import { LanguageSetup } from '@/components/LanguageSetup';
import { SampleLesson } from '@/components/SampleLesson';
import { SessionHome } from '@/components/practice/SessionHome';
import { Text, View } from '@/components/Themed';
import { useLearner } from '@/state/learnerStore';
import { useSettings } from '@/state/settingsStore';

export default function LearnScreen() {
  const { profile } = useLearner();
  const settings = useSettings();
  if (!profile) return <LanguageSetup />;
  return (
    <View style={styles.screen}>
      {settings.micDenied ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Turn on mic" onPress={() => void Linking.openSettings()} style={styles.banner}>
          <Text style={styles.bannerText}>Turn on mic</Text>
        </Pressable>
      ) : null}
      <SessionHome />
      <SampleLesson />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2f95dc',
  },
  bannerText: {
    color: '#fff',
    fontWeight: '600',
  },
});
