import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { AccessInvite, AdminRoleId } from '../types';

interface AdminInviteListResponse {
  ok: true;
  invites: AccessInvite[];
}

interface AdminInviteCreateResponse {
  ok: true;
  invite: AccessInvite;
}

interface AdminInviteRevokeResponse {
  ok: true;
  invite: AccessInvite;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const listAdminInvites = async (): Promise<AccessInvite[]> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminInviteListResponse>('admin-invite-list', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.invites;
};

export const createAdminInvite = async (payload: {
  email: string;
  adminRoleIds: AdminRoleId[];
}): Promise<AccessInvite> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<
    AdminInviteCreateResponse,
    { email: string; adminRoleIds: AdminRoleId[] }
  >('admin-invite-create', {
    method: 'POST',
    body: payload,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.invite;
};

export const revokeAdminInvite = async (inviteId: string): Promise<AccessInvite> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AdminInviteRevokeResponse, { inviteId: string }>(
    'admin-invite-revoke',
    {
      method: 'POST',
      body: { inviteId },
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );
  return response.invite;
};
