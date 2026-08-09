import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import type { ReactNode } from "react";

export function ProtectedRoute({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-ink bg-paper-2 flex items-center justify-center shadow-[4px_4px_0_#1c1813] animate-blink">
          <span className="font-mono text-xs font-bold text-orange">SF</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/" replace />;

  return <>{children}</>;
}
