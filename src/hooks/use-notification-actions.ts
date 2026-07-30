import { apiClient } from "../lib/api-client";
import { type Notification } from "../components/common/NotificationHelpers";
import type React from "react";

export function useNotificationActions(
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>,
  setUnreadCount?: React.Dispatch<React.SetStateAction<number>>
) {
  const markRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n
      )
    );
    if (setUnreadCount) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    const { error } = await apiClient.patch(`/notifications/${id}/read`, {});
    if (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllRead = async () => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
    );
    if (setUnreadCount) {
      setUnreadCount(0);
    }

    const { error } = await apiClient.post("/notifications/read-all", {});
    if (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  return { markRead, markAllRead };
}
