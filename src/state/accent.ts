let apply: ((locale: string) => void) | null = null;

export function bindAccent(next: (locale: string) => void) {
  apply = next;
}

export function chooseAccent(locale: string) {
  apply?.(locale);
}
