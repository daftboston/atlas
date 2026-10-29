/**
 * The local mock list for the blocking demo (docs/architecture.md §7.1). These are not real bundle ids.
 * On a device, the system picker returns opaque tokens and the app never sees app names, so this list
 * exists only to make the demo possible in the simulator.
 */
export type DemoApp = {
  id: string;
  name: string;
  /** SF Symbol on iOS, with an Android and web fallback (expo-symbols). */
  symbol: { ios: string; android: string; web: string };
};

export const DEMO_APPS: readonly DemoApp[] = [
  { id: 'instagram', name: 'Instagram', symbol: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' } },
  { id: 'facebook', name: 'Facebook', symbol: { ios: 'person.2.fill', android: 'group', web: 'group' } },
  { id: 'pinterest', name: 'Pinterest', symbol: { ios: 'pin.fill', android: 'push_pin', web: 'push_pin' } },
  { id: 'tiktok', name: 'TikTok', symbol: { ios: 'music.note', android: 'music_note', web: 'music_note' } },
  { id: 'youtube', name: 'YouTube', symbol: { ios: 'play.rectangle.fill', android: 'smart_display', web: 'smart_display' } },
  { id: 'x', name: 'X', symbol: { ios: 'xmark', android: 'close', web: 'close' } },
];

export function demoAppById(id: string): DemoApp | null {
  return DEMO_APPS.find((app) => app.id === id) ?? null;
}
