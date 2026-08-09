import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import { ToastProvider } from "./context/ToastContext.js";
import { Layout } from "./components/Layout.js";
import { Landing } from "./pages/Landing.js";
import { Login } from "./pages/Login.js";
import { OAuthCallback } from "./pages/OAuthCallback.js";
import { Events } from "./pages/Events.js";
import { EventDetail } from "./pages/EventDetail.js";
import { MyRegistrations } from "./pages/MyRegistrations.js";
import { AttendeeDashboard } from "./pages/AttendeeDashboard.js";
import { AdminDashboard } from "./pages/AdminDashboard.js";
import { AdminScanner } from "./pages/AdminScanner.js";
import { AdminEvents } from "./pages/AdminEvents.js";
import { AdminEventDetail } from "./pages/AdminEventDetail.js";
import { AdminTeam } from "./pages/AdminTeam.js";
import { AdminAttendees } from "./pages/AdminAttendees.js";
import { AdminRegistrations } from "./pages/AdminRegistrations.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="login" element={<Login />} />
            <Route path="oauth/callback" element={<OAuthCallback />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route
              path="my-registrations"
              element={
                <ProtectedRoute>
                  <MyRegistrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <AttendeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/events"
              element={
                <ProtectedRoute adminOnly>
                  <AdminEvents />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/scan"
              element={
                <ProtectedRoute adminOnly>
                  <AdminScanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/events/:id"
              element={
                <ProtectedRoute adminOnly>
                  <AdminEventDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/attendees"
              element={
                <ProtectedRoute adminOnly>
                  <AdminAttendees />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/registrations"
              element={
                <ProtectedRoute adminOnly>
                  <AdminRegistrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/team"
              element={
                <ProtectedRoute adminOnly>
                  <AdminTeam />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
