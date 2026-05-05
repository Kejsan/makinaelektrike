import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

export const activateAdminDealerAccount = async (payload: {
  dealerId: string;
  email: string;
  password: string;
}) => {
  const idToken = await getRequiredIdToken();

  return fetchFunctionJson<{
    ok: true;
    dealerId: string;
    uid: string;
    email: string;
    mode: 'created' | 'updated' | 'recreated';
  }, typeof payload>('admin-dealer-account-activate', {
    method: 'POST',
    body: payload,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};
