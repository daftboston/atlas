import { Placeholder } from '@/components/Placeholder';

export default function PracticeSessionScreen() {
  return (
    <Placeholder
      title="Practice"
      purpose="A practice session: hear a prompt, say it aloud, get feedback, then move to the next one."
      next={{ href: '/(tabs)/learn', label: 'Back to Learn' }}
    />
  );
}
