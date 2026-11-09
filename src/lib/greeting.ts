export type GreetingKey = 'morning' | 'afternoon' | 'evening';

// Avant 12 h : matin ; 12 h à 17 h 59 : après-midi ; dès 18 h : soir.
export function getGreetingKey(hour: number): GreetingKey {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
