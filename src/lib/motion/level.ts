export type MotionLevel = 'none' | 'light' | 'rich';

type MotionInput = {
  width: number;
  reducedMotion: boolean;
  saveData?: boolean;
  deviceMemory?: number;
};

// Ordre des règles : le choix du visiteur (réduire) passe avant tout, puis téléphone / appareil faible.
export function getMotionLevel({
  width,
  reducedMotion,
  saveData,
  deviceMemory,
}: MotionInput): MotionLevel {
  if (reducedMotion) return 'none';
  if (width < 768) return 'light';
  if (saveData) return 'light';
  if (deviceMemory !== undefined && deviceMemory <= 2) return 'light';
  return 'rich';
}
