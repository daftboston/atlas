import { useRouter } from 'expo-router';

import { OnboardingFrame, PrimaryButton } from '@/components/ui/ios';
import { useSingleTap } from '@/lib/useSingleTap';
import { useReviewHome } from '@/state/reviewStore';
import { completeOnboarding } from '@/state/settingsStore';

export default function DoneScreen() {
  const router = useRouter();
  const review = useReviewHome();
  const scheduled = review.ready ? review.home.due.length + review.home.upcoming.length : 0;

  const finish = useSingleTap(() => {
    completeOnboarding();
    router.replace('/(tabs)/learn');
  });

  return (
    <OnboardingFrame
      title="You're ready"
      copy={
        scheduled === 0
          ? 'Your next session will put the first reviews on the schedule.'
          : `${scheduled} ${scheduled === 1 ? 'review is' : 'reviews are'} on the schedule.`
      }
      footer={<PrimaryButton label="Go to Learn" onPress={finish} />}
    />
  );
}
