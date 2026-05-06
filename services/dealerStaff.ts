import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { AccessInvite, DealerStaffRole } from '../types';

export interface DealerStaffMember {
  uid: string;
  email: string | null;
  displayName: string | null;
  accountStatus: string | null;
  dealerStaffRole: DealerStaffRole | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DealerTeamCapacity {
  maxTeamAccounts: number;
  ownerCount: number;
  activeStaffCount: number;
  pendingInviteCount: number;
  remainingSlots: number;
}

interface DealerStaffListResponse {
  ok: true;
  dealerId: string;
  capacity: DealerTeamCapacity;
  staffMembers: DealerStaffMember[];
  invites: AccessInvite[];
}

interface DealerStaffInviteCreateResponse {
  ok: true;
  invite: AccessInvite;
  capacity: DealerTeamCapacity;
}

interface DealerStaffInviteRevokeResponse {
  ok: true;
  invite: AccessInvite;
}

interface DealerStaffMemberUpdateResponse {
  ok: true;
  uid: string;
  removed: boolean;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this dealer action.');
  }

  return currentUser.getIdToken();
};

export const listDealerStaff = async (
  dealerId: string,
): Promise<{ capacity: DealerTeamCapacity; staffMembers: DealerStaffMember[]; invites: AccessInvite[] }> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<DealerStaffListResponse>('dealer-staff-list', {
    method: 'GET',
    query: { dealerId },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  return {
    capacity: response.capacity,
    staffMembers: response.staffMembers,
    invites: response.invites,
  };
};

export const createDealerStaffInvite = async (payload: {
  dealerId: string;
  email: string;
  dealerStaffRole: Extract<DealerStaffRole, 'manager' | 'editor'>;
}): Promise<{ invite: AccessInvite; capacity: DealerTeamCapacity }> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<
    DealerStaffInviteCreateResponse,
    { dealerId: string; email: string; dealerStaffRole: Extract<DealerStaffRole, 'manager' | 'editor'> }
  >('dealer-staff-invite-create', {
    method: 'POST',
    body: payload,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  return {
    invite: response.invite,
    capacity: response.capacity,
  };
};

export const revokeDealerStaffInvite = async (payload: {
  dealerId: string;
  inviteId: string;
}): Promise<AccessInvite> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<
    DealerStaffInviteRevokeResponse,
    { dealerId: string; inviteId: string }
  >('dealer-staff-invite-revoke', {
    method: 'POST',
    body: payload,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.invite;
};

export const removeDealerStaffMember = async (payload: {
  dealerId: string;
  userUid: string;
}): Promise<DealerStaffMemberUpdateResponse> => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<
    DealerStaffMemberUpdateResponse,
    { dealerId: string; userUid: string; action: 'remove' }
  >('dealer-staff-member-update', {
    method: 'POST',
    body: {
      ...payload,
      action: 'remove',
    },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};
