import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Group, OnboardingFrame, PrimaryButton, ChoiceRow } from '@/components/ui/ios';
import { V0_COURSE } from '@/content/sample-lesson';
import { SPANISH_ACCENTS } from '@/domain/language/profiles/es';
import { useSingleTap } from '@/lib/useSingleTap';
import { chooseAccent } from '@/state/accent';
import { startCourse } from '@/state/learnerStore';

export default function LanguageScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(SPANISH_ACCENTS[0].locale);

  const next = useSingleTap(() => {
    chooseAccent(selected);
    void startCourse(V0_COURSE.courseId);
    router.push('/(onboarding)/mic');
  });

  return (
    <OnboardingFrame
      title="Accent"
      copy="English to Spanish. Choose the accent you want to hear."
      footer={<PrimaryButton label="Next" onPress={next} />}>
      <Group>
        {SPANISH_ACCENTS.map((accent) => (
          <ChoiceRow key={accent.label} label={accent.label} selected={selected === accent.locale} onPress={() => setSelected(accent.locale)} />
        ))}
      </Group>
    </OnboardingFrame>
  );
}
