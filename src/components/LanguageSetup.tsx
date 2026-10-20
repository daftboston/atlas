import { StyleSheet } from 'react-native';

import { Text, useThemeColor, View } from '@/components/Themed';
import { Group, PrimaryButton, SectionFooter } from '@/components/ui/ios';
import { COURSES, languageLabel } from '@/content/sample-lesson';
import { startCourse } from '@/state/learnerStore';

export function LanguageSetup() {
  // v0 has exactly one course (English -> Spanish), so there is nothing to pick.
  const course = COURSES[0];
  const nativeLabel = languageLabel(course.nativeLanguage);
  const targetLabel = languageLabel(course.targetLanguage);
  const summary = `You speak ${nativeLabel}, you're learning ${targetLabel}`;
  const secondary = useThemeColor({}, 'secondaryText');

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Your course
      </Text>
      <Group>
        <View style={styles.course} accessible accessibilityLabel={`Course: ${summary}`}>
          <Text style={styles.courseText}>{summary}</Text>
        </View>
      </Group>
      <Text style={[styles.copy, { color: secondary }]}>More languages are coming later. This first lesson is a sample.</Text>
      <PrimaryButton
        label="Continue"
        onPress={() => startCourse(course.courseId)}
      />
      <SectionFooter>{`Starts the ${nativeLabel} to ${targetLabel} course`}</SectionFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  course: { paddingHorizontal: 16, paddingVertical: 14 },
  courseText: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  copy: { fontSize: 17, lineHeight: 22 },
});
