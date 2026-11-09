import { describe, expect, it } from 'vitest';
import { getGreetingKey } from '@/lib/greeting';

describe('getGreetingKey', () => {
  it.each([
    [0, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [23, 'evening'],
  ])('heure %i -> %s', (hour, key) => {
    expect(getGreetingKey(hour)).toBe(key);
  });
});
