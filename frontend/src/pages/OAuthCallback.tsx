import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getSupabase } from "../lib/client.js";
import { useAuth } from "../context/AuthContext.js";
import { FakeQR } from "../components/FakeQR.js";

export function OAuthCallback() {
  const { isLoading } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);
  const [status, setStatus] = useState<"ok" | "error" | "running">(isLoading ? "running" : "ok");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (started.current || isLoading) return;
    started.current = true;

    const query = new URLSearchParams(window.location.search);
    const errCode = query.get("error") || query.get("error_code");

    // Popup flow: the opener tab keeps running and is notified via Supabase's
    // cross-tab storage broadcast — nothing else to do here but close.
    if (window.opener) {
      if (errCode) window.close();
      getSupabase()
        .auth.getSession()
        .then(({ data }) => {
          window.close();
        })
        .catch(() => window.close());
      return;
    }

    if (errCode) {
      setStatus("error");
      setMessage("Google didn't approve the sign-in. Please try again.");
      return;
    }

    setStatus("running");

    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) {
          navigate("/events", { replace: true });
        } else {
          setStatus("error");
          setMessage("No pass was handed over. Head back and try the door again.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Couldn't validate your pass. Please sign in again.");
      });
  }, [isLoading, navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 relative">
      <div className="absolute top-10 left-10 w-24 h-24 bg-lime/80 border-2 border-ink rotate-6 hidden lg:block animate-blink" />
      <div className="absolute bottom-12 right-10 w-24 h-24 bg-orange/80 border-2 border-ink -rotate-6 hidden lg:block animate-blink" />

      <div className="w-full max-w-md text-center relative">
        {status === "error" ? (
          <div className="paper-card p-10 animate-fade-up">
            <span className="stamp text-red mb-6 inline-block">TOO LATE</span>
            <h1 className="display text-4xl mb-4">Entry Refused</h1>
            <p className="text-ink-soft mb-8">{message}</p>
            <Link to="/login" className="btn btn-ink">Try the Door Again</Link>
          </div>
        ) : (
          <div className="paper-card p-10 animate-fade-up">
            <span className="display text-6xl block mb-6 animate-blink">…</span>
            <h1 className="display text-3xl mb-2">Punching Your Ticket</h1>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">
              Validating pass · preparing the door
            </p>
            <div className="mt-8 pt-6 border-t-2 border-dashed border-ink">
              <FakeQR seed="ticket-in-flight" className="w-40 mx-auto" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}