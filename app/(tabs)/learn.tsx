import { Linking, ScrollView, StyleSheet } from 'react-native';

import { LanguageSetup } from '@/components/LanguageSetup';
import { SampleLesson } from '@/components/SampleLesson';
import { SessionHome } from '@/components/practice/SessionHome';
import { Text, View } from '@/components/Themed';
import { Group, ScreenTitle, TextButton } from '@/components/ui/ios';
import { useLearner } from '@/state/learnerStore';
import { useSettings } from '@/state/settingsStore';

export default function LearnScreen() {
  const { profile } = useLearner();
  const settings = useSettings();
  if (!profile) return <LanguageSetup />;
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
      <ScreenTitle>Learn</ScreenTitle>
      {settings.micDenied ? (
        <Group>
          <View style={styles.banner}>
            <Text style={styles.copy}>The microphone is off, so you can type your answers.</Text>
            <TextButton label="Turn on mic" onPress={() => void Linking.openSettings()} />
          </View>
        </Group>
      ) : null}
      <SessionHome />
      <SampleLesson />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 22, paddingBottom: 128 },
  banner: { paddingHorizontal: 16, paddingTop: 12 },
  copy: { fontSize: 17, lineHeight: 22 },
});