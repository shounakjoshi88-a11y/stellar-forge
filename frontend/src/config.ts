declare global {
  interface Window {
    process?: { env?: Record<string, string | undefined> };
  }
}

const env = globalThis.process?.env ?? {};

export const API_URL: string = process.env.BUN_PUBLIC_API_URL || "http://localhost:3001/api";
export const SUPABASE_URL: string =
  process.env.BUN_PUBLIC_SUPABASE_URL || "http://localhost:54321";
export const SUPABASE_ANON_KEY: string = process.env.BUN_PUBLIC_SUPABASE_ANON_KEY || "";
