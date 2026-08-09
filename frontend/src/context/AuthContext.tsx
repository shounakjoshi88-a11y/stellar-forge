import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";
import { getSupabase } from "../lib/client.js";
import { API_URL } from "../config.js";

interface User {
  id: string;
  email: string;
  name: string;
  role: "ATTENDEE" | "ADMIN";
  isOwner?: boolean;
}

interface AuthContextType {
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (active) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      try {
        const res = await axios.get(`${API_URL}/auth/me`);
        if (active) setUser(res.data);
      } catch {
        delete axios.defaults.headers.common["Authorization"];
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    // Live revocation: any 401/403 from the API revalidates against /auth/me
    // right away, so a demoted admin loses their nav + admin routes immediately
    // instead of on the next page load.
    let bouncing = false;
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      async (error) => {
        const status = error?.response?.status;
        if ((status === 401 || status === 403) && !bouncing) {
          bouncing = true;
          try {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) {
              if (active) setUser(null);
              return Promise.reject(error);
            }
            const res = await axios.get(`${API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (active) setUser(res.data);
          } catch {
            if (active) setUser(null);
          } finally {
            bouncing = false;
          }
        }
        return Promise.reject(error);
      }
    );

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        delete axios.defaults.headers.common["Authorization"];
        if (active) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      axios.defaults.headers.common["Authorization"] = `Bearer ${session.access_token}`;
      try {
        const res = await axios.get(`${API_URL}/auth/me`);
        if (active) setUser(res.data);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    });

    loadUser();

    return () => {
      active = false;
      axios.interceptors.response.eject(interceptor);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const supabase = getSupabase();
    // Build the OAuth URL (async) but open the window synchronously inside the
    // click gesture, so popup blockers don't kill it. The callback page runs in
    // the popup and closes itself once the session lands; this tab is notified
    // via Supabase's cross-tab storage broadcast (onAuthStateChange below).
    const done = supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/oauth/callback`,
        skipBrowserRedirect: true,
      },
    });

    const popup = window.open(
      "about:blank",
      "google_oauth",
      "width=760,height=740,left=120,top=120,popup=yes"
    );
    if (!popup) throw new Error("Sign-in window was blocked. Allow popups and try again.");

    try {
      const { data, error } = await done;
      if (error) throw error;
      if (!data?.url) throw new Error("OAuth URL unavailable");
      popup.location.href = data.url;
    } catch (err) {
      popup.close();
      throw err;
    }
  };

  const logout = async () => {
    await getSupabase().auth.signOut();
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signInWithGoogle, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}