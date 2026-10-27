import { useRouter } from 'expo-router';

import { useSingleTap } from '@/lib/useSingleTap';
import { OnboardingFrame, PrimaryButton } from '@/components/ui/ios';

export default function WelcomeScreen() {
  const router = useRouter();
  const next = useSingleTap(() => router.push('/(onboarding)/language'));
  return (
    <OnboardingFrame
      title="Welcome"
      copy="Atlas gets you speaking from the first minute, in short daily sessions."
      footer={<PrimaryButton label="Next" onPress={next} />}
    />
  );
}
