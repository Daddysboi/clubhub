import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** The only class-composition helper. Never build class strings by hand. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}