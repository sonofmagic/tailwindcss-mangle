import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

cn('w-10 h-10 bg-red-500 and bg-red-500/50')

cn(`w-2 h-2 bg-red-600 and bg-red-600/50`)

twMerge('w-1 h-1 bg-red-400 and bg-red-400/50')