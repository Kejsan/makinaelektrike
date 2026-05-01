import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { AdminAuditLog } from '../types';

interface AdminAuditListResponse {
  ok: true;
  logs: AdminAuditLog[];
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const listAdminAuditLogs = async (limit = 50): Promise<AdminAuditLog[]> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminAuditListResponse>('admin-audit-list', {
    method: 'GET',
    query: { limit },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  return response.logs;
};
