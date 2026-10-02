import { clsx, type ClassValue } from 'clsx';

/** Joins conditional class names. */
export function cx(...values: ClassValue[]): string {
  return clsx(values);
}
