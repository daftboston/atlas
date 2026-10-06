import { Placeholder } from '@/components/Placeholder';

export default function HabitScreen() {
  return (
    <Placeholder
      title="Daily habit"
      purpose="An introduction to unlocks and Screen Time. Screen Time support is coming later."
      next={{ href: '/(onboarding)/done', label: 'Next' }}
    />
  );
}
