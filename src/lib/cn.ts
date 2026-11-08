import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Fusionne les classes et résout les conflits Tailwind (la dernière gagne).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
