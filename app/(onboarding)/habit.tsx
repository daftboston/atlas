import { useRouter } from 'expo-router';

import { OnboardingFrame, PrimaryButton, TextButton } from '@/components/ui/ios';
import { useSingleTap } from '@/lib/useSingleTap';

export default function HabitScreen() {
  const router = useRouter();
  const next = useSingleTap(() => router.push('/(onboarding)/done'));
  return (
    <OnboardingFrame
      title="Daily habit"
      copy="A finished session can earn a few free minutes. Screen Time is coming later, so for now Atlas shows a timer."
      footer={
        <>
          <PrimaryButton label="Next" onPress={next} />
          <TextButton label="Skip" onPress={next} />
        </>
      }
    />
  );
}
