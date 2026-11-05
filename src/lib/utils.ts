/**
 * lib/utils.ts — Utility helpers.
 * cn() merges Tailwind class names safely (needed for shadcn/ui components).
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
