/**
 * Shadcn/ui utility — cn() for merging Tailwind classes.
 *
 * This is the standard Shadcn utility used by ALL ui components.
 * DO NOT modify — Shadcn components depend on this exact signature.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
