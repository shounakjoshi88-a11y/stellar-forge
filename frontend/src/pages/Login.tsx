import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { AlertCircle } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.1 3.57-5.19 3.57-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

export function Login() {
  const { user } = useAuth();
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Popup flow: Supabase broadcasts the new session to this tab after the popup
  // closes itself, so bouncing to /events is our "success screen".
  useEffect(() => {
    if (user) navigate("/events", { replace: true });
  }, [user, navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setLoading(false);
      setError("Couldn't reach the sign-in provider. Try again.");
    }
  };

  const query = new URLSearchParams(window.location.search);
  const badCode = query.get("error");

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 relative">
      <div className="absolute top-10 left-8 w-28 h-28 bg-orange/80 border-2 border-ink rotate-6 hidden lg:block animate-blink" />
      <div className="absolute bottom-12 right-10 w-28 h-28 bg-blue/80 border-2 border-ink -rotate-6 hidden lg:block animate-blink" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <span className="stamp text-orange mb-6 inline-block">Gate 03</span>
          <h1 className="display text-5xl md:text-6xl mb-4">Sign In</h1>
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">
            Your Google account is your ticket
          </p>
        </div>

        <div className="paper-card p-8 animate-fade-up">
          {(error || (badCode && showMap(badCode))) && (
            <div className="flex items-center gap-3 p-4 border-2 border-ink bg-red text-paper text-sm font-semibold mb-6">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error || (badCode ? showMap(badCode) : "")}
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="btn btn-ink w-full !py-4 !justify-center text-base"
          >
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </button>

          {loading && (
            <p className="mt-6 font-mono text-xs uppercase tracking-widest text-ink-soft text-center animate-blink">
              Opening the sign-in window…
            </p>
          )}

          <div className="mt-8 pt-6 border-t-2 border-dashed border-ink relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-card px-3 label-mono text-ink-soft">
              THE FINE PRINT
            </span>
            <ul className="space-y-2 pt-2 text-sm text-ink-soft">
              <li>✦ First sign-in creates your account automatically.</li>
              <li>✦ Your tickets and history follow this Google account.</li>
              <li>✦ The org admin is auto-promoted on their first sign-in.</li>
              {user && (
                <li className="font-semibold text-ink">
                  Already signed in, <Link to="/events" className="text-blue underline">keep going →</Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        <p className="text-center mt-8 font-mono text-xs uppercase tracking-widest text-ink-soft">
          <Link to="/" className="hover:text-orange transition-colors">← Back to the front page</Link>
        </p>
      </div>
    </div>
  );
}

function showMap(code: string): string {
  const map: Record<string, string> = {
    google_denied: "Sign-in was cancelled. Nothing happened — try again when ready.",
    missing_params: "Google returned an incomplete response. Try again.",
    expired_state: "That sign-in attempt expired. Please try again.",
    token_exchange_failed: "Google didn't issue a pass. Try again in a moment.",
    invalid_profile: "Couldn't verify your profile. Use an account with an email.",
    server_error: "Something jammed on our end. Try again shortly.",
  };
  return map[code] || "Sign-in failed. Please try again.";
}