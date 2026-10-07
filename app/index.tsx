import { Redirect } from 'expo-router';

// Learn lives at /learn (architecture §3), so the app's root URL forwards there.
export default function Index() {
  return <Redirect href="/(tabs)/learn" />;
}
