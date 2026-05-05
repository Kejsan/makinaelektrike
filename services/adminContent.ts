import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { BlogPost, Dealer, Model } from '../types';

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this admin action.');
  }

  return currentUser.getIdToken();
};

const withAdminAuth = async <TResponse, TBody = unknown>(
  functionName: string,
  body: TBody,
) => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<TResponse, TBody>(functionName, {
    method: 'POST',
    body,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};

export const saveAdminDealer = async (payload: {
  dealerId?: string;
  values: Record<string, unknown>;
}) =>
  withAdminAuth<{
    ok: true;
    dealerId: string;
    dealer: Dealer;
  }, typeof payload>('admin-dealer-save', payload);

export const saveAdminModel = async (payload: {
  modelId?: string;
  values: Record<string, unknown>;
}) =>
  withAdminAuth<{
    ok: true;
    modelId: string;
    model: Model;
  }, typeof payload>('admin-model-save', payload);

export const saveAdminBlogPost = async (payload: {
  postId?: string;
  values: Record<string, unknown>;
}) =>
  withAdminAuth<{
    ok: true;
    postId: string;
    post: BlogPost;
  }, typeof payload>('admin-blog-save', payload);
