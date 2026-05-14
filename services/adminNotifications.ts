import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { AdminNotification } from '../types';

interface AdminNotificationListResponse {
  ok: true;
  notifications: AdminNotification[];
  unreadCount: number;
  generatedAt: string;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to load admin notifications.');
  }

  return currentUser.getIdToken();
};

export const listAdminNotifications = async () => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<AdminNotificationListResponse>('admin-notification-list', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};
