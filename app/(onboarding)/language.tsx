import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { V0_COURSE } from '@/content/sample-lesson';
import { SPANISH_ACCENTS } from '@/domain/language/profiles/es';
import { chooseAccent } from '@/state/accent';
import { startCourse } from '@/state/learnerStore';

export default function LanguageScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(SPANISH_ACCENTS[0].locale);

  function next() {
    chooseAccent(selected);
    void startCourse(V0_COURSE.courseId);
    router.push('/(onboarding)/mic');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Accent
      </Text>
      <Text style={styles.copy}>English to Spanish. Choose the accent you want to hear.</Text>
      {SPANISH_ACCENTS.map((accent) => {
        const chosen = selected === accent.locale;
        return (
          <Pressable
            key={accent.locale}
            accessibilityRole="button"
            accessibilityLabel={accent.label}
            accessibilityState={{ selected: chosen }}
            onPress={() => setSelected(accent.locale)}
            style={[styles.choice, chosen && styles.choiceSelected]}>
            <Text style={styles.choiceText}>{accent.label}</Text>
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={next} style={styles.primary}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          Next
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700' },
  copy: { fontSize: 18, lineHeight: 26, marginBottom: 8 },
  choice: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 14 },
  choiceSelected: { borderColor: '#2f95dc' },
  choiceText: { fontSize: 17 },
  primary: { backgroundColor: '#2f95dc', borderRadius: 8, alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  primaryText: { fontSize: 17, fontWeight: '600' },
});
