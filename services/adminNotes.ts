import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { AdminEntityNote, AuditEntityType } from '../types';

interface AdminEntityNoteCreateResponse {
  ok: true;
  note: AdminEntityNote;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const createAdminEntityNote = async (payload: {
  entityType: Extract<AuditEntityType, 'user' | 'dealer' | 'listing'>;
  entityId: string;
  body: string;
}) => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<
    AdminEntityNoteCreateResponse,
    { entityType: string; entityId: string; body: string }
  >('admin-entity-note-create', {
    method: 'POST',
    body: payload,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};
