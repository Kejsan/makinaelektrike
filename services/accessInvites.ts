import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { AccessInvite } from '../types';

interface AccessInviteLookupResponse {
  ok: true;
  invite: AccessInvite;
}

interface AccessInviteAcceptResponse {
  ok: true;
  invite: AccessInvite;
  nextPath: string;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }

  return currentUser.getIdToken();
};

export const lookupAccessInvite = async (code: string): Promise<AccessInvite> => {
  const response = await fetchFunctionJson<AccessInviteLookupResponse>('access-invite-lookup', {
    method: 'GET',
    query: { code },
  });
  return response.invite;
};

export const acceptAccessInvite = async (
  code: string,
): Promise<{ invite: AccessInvite; nextPath: string }> => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<AccessInviteAcceptResponse, { code: string }>(
    'access-invite-accept',
    {
      method: 'POST',
      body: { code },
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  return {
    invite: response.invite,
    nextPath: response.nextPath,
  };
};
