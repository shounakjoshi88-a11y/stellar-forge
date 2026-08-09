import { useToast } from "../context/ToastContext.js";
import { useLiveActivity } from "../hooks/useLive.js";

/**
 * Turns live registration / door-scan broadcasts into in-page toasts —
 * the platform feels alive no matter where you're looking.
 */
export function LiveActivityToaster() {
  const { toast } = useToast();

  useLiveActivity((msg) => {
    if (msg.type === "registration") {
      toast(`${msg.attendeeFirstName ?? "Someone"} registered · ${msg.eventTitle ?? "an event"}`, "success");
    } else if (msg.type === "scan") {
      const label = msg.direction === "entry" ? "ENTRY" : "EXIT";
      toast(`${label} · ${msg.attendee ?? "Attendee"} · ${msg.eventTitle ?? "event"}`, msg.direction === "entry" ? "success" : "info");
    }
  });

  return null;
}