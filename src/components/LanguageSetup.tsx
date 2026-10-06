import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { COURSES, languageLabel } from '@/content/sample-lesson';
import { setProfile } from '@/lib/learner-store';

export function LanguageSetup() {
  // v0 has exactly one course (English -> Spanish), so there is nothing to pick.
  const course = COURSES[0];
  const nativeLabel = languageLabel(course.nativeLanguage);
  const targetLabel = languageLabel(course.targetLanguage);
  const summary = `You speak ${nativeLabel}, you're learning ${targetLabel}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Your course
      </Text>
      <View style={styles.course} accessible accessibilityLabel={`Course: ${summary}`}>
        <Text style={styles.courseText}>{summary}</Text>
      </View>
      <Text style={styles.copy}>More languages are coming later. This first lesson is a sample.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue"
        accessibilityHint={`Starts the ${nativeLabel} to ${targetLabel} course`}
        style={styles.continue}
        onPress={() =>
          setProfile({ nativeLanguage: course.nativeLanguage, targetLanguage: course.targetLanguage })
        }>
        <Text style={styles.continueText} lightColor="#fff" darkColor="#000">
          Continue
        </Text>
      </Pressable>
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
  course: {
    borderWidth: 1,
    borderColor: '#2f95dc',
    backgroundColor: 'rgba(47, 149, 220, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  courseText: {
    fontSize: 18,
    fontWeight: '600',
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.8,
  },
  continue: {
    marginTop: 20,
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 14,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
