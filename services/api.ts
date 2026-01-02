import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from './firebase';
import type { Dealer, DealerDocument, Model, DealerModel, BlogPost, DealerStatus } from '../types';
import { omitUndefined } from '../utils/object';

export type WithId<T> = T & { id: string };

export type SnapshotMapper<T> = (snapshot: QueryDocumentSnapshot<DocumentData>) => T;

export const createCollectionMapper = <T extends { id: string }>(
  mapper?: SnapshotMapper<T>,
) => {
  const defaultMapper: SnapshotMapper<T> = snapshot =>
    ({ id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as T);

  const mapFn = mapper ?? defaultMapper;

  return (snapshot: QuerySnapshot<DocumentData>): T[] =>
    snapshot.docs.map(docSnapshot => mapFn(docSnapshot));
};

const dealersCollection = collection(firestore, 'dealers');
const modelsCollection = collection(firestore, 'models');
const blogPostsCollection = collection(firestore, 'blogPosts');
const dealerModelsCollection = collection(firestore, 'dealerModels');
const listingsCollection = collection(firestore, 'listings');

const compareStrings = (a?: string | null, b?: string | null) => {
  const first = (a ?? '').trim().toLocaleLowerCase();
  const second = (b ?? '').trim().toLocaleLowerCase();
  return first.localeCompare(second);
};

export const sortDealersByName = (dealers: Dealer[]) =>
  [...dealers].sort((first, second) => compareStrings(first.name, second.name));

export const sortModels = (models: Model[]) =>
  [...models].sort((first, second) => {
    const brandComparison = compareStrings(first.brand, second.brand);
    if (brandComparison !== 0) {
      return brandComparison;
    }

    return compareStrings(first.model_name, second.model_name);
  });

export const sortBlogPostsByDateDesc = (posts: BlogPost[]) =>
  [...posts].sort((first, second) => {
    const firstTime = new Date(first.date ?? '').getTime();
    const secondTime = new Date(second.date ?? '').getTime();

    if (Number.isNaN(firstTime) && Number.isNaN(secondTime)) {
      return compareStrings(first.title, second.title);
    }

    if (Number.isNaN(firstTime)) {
      return 1;
    }

    if (Number.isNaN(secondTime)) {
      return -1;
    }

    return secondTime - firstTime;
  });

const mapDealersRaw = createCollectionMapper<Dealer>();
const normalizeDealerStatus = (dealer: Dealer): Dealer => {
  const explicitStatus = dealer.status as DealerStatus | undefined;
  let status: DealerStatus;

  if (explicitStatus) {
    status = explicitStatus;
  } else if (dealer.approved === false) {
    status = 'pending';
  } else if (dealer.isDeleted || dealer.status === 'deleted') {
    status = 'deleted';
  } else {
    status = 'approved';
  }

  const isActive = dealer.isActive ?? (status === 'approved');

  return {
    ...dealer,
    status,
    isActive,
    approved: status === 'approved',
  };
};

const mapDealers = (snapshot: QuerySnapshot<DocumentData>): Dealer[] =>
  mapDealersRaw(snapshot).map(normalizeDealerStatus);
const mapModels = createCollectionMapper<Model>();
const mapBlogPosts = createCollectionMapper<BlogPost>();
const mapDealerModels = createCollectionMapper<WithId<DealerModel>>();
const mapDealerModelsWithoutId = (snapshot: QuerySnapshot<DocumentData>): DealerModel[] =>
  mapDealerModels(snapshot).map(({ id: _id, ...rest }) => rest);

export type SnapshotCallback<T> = (items: T[]) => void;

export type SubscriptionOptions<T> = {
  onData: SnapshotCallback<T>;
  onError?: (error: FirestoreError) => void;
};

export const subscribeToCollection = <T extends { id: string }>(
  colQuery: ReturnType<typeof query>,
  mapper: (snapshot: QuerySnapshot<DocumentData>) => T[],
  options: SubscriptionOptions<T>,
): Unsubscribe =>
  onSnapshot(colQuery, snapshot => options.onData(mapper(snapshot)), options.onError);

export const listDealers = async (): Promise<Dealer[]> => {
  const snapshot = await getDocs(query(dealersCollection, orderBy('name', 'asc')));
  return mapDealers(snapshot);
};

export const getDealerById = async (id: string): Promise<Dealer | null> => {
  const snapshot = await getDoc(doc(dealersCollection, id));
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<Dealer, 'id'>) };
};

export const createDealer = async (payload: DealerDocument): Promise<Dealer> => {
  const sanitizedPayload = omitUndefined(payload as unknown as Record<string, unknown>);
  const derivedStatus = (payload.status ?? 'pending') as DealerDocument['status'];
  const derivedApproved = payload.approved ?? derivedStatus === 'approved';
  const derivedIsActive =
    payload.isActive ?? (derivedStatus === 'approved' && derivedApproved ? true : false);
  const docRef = await addDoc(dealersCollection, {
    ...sanitizedPayload,
    approved: derivedApproved,
    isActive: derivedIsActive,
    status: derivedStatus,
    isDeleted: payload.isDeleted ?? false,
    deletedAt: payload.deletedAt ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(docRef);
  return normalizeDealerStatus({ id: snapshot.id, ...(snapshot.data() as DealerDocument) });
};

export const updateDealer = async (id: string, updates: Partial<DealerDocument>): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  const sanitizedUpdates = omitUndefined(updates as unknown as Record<string, unknown>);
  await updateDoc(dealerRef, { ...sanitizedUpdates, updatedAt: serverTimestamp() });
  const snapshot = await getDoc(dealerRef);
  return normalizeDealerStatus({ id: snapshot.id, ...(snapshot.data() as DealerDocument) });
};

export const deleteDealer = async (id: string): Promise<void> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    approved: false,
    isDeleted: true,
    isActive: false,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const approveDealerStatus = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    approved: true,
    status: 'approved',
    isActive: true,
    isDeleted: false,
    approvedAt: serverTimestamp(),
    rejectedAt: null,
    deletedAt: null,
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(dealerRef);
  return { id: snapshot.id, ...(snapshot.data() as DealerDocument) };
};

export const rejectDealerStatus = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    approved: false,
    status: 'rejected',
    isActive: false,
    rejectedAt: serverTimestamp(),
    approvedAt: null,
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(dealerRef);
  return { id: snapshot.id, ...(snapshot.data() as DealerDocument) };
};

export const deactivateDealerStatus = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    approved: true,
    status: 'approved',
    isActive: false,
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(dealerRef);
  return { id: snapshot.id, ...(snapshot.data() as DealerDocument) };
};

export const reactivateDealerStatus = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    approved: true,
    status: 'approved',
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    approvedAt: serverTimestamp(),
    rejectedAt: null,
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(dealerRef);
  return { id: snapshot.id, ...(snapshot.data() as DealerDocument) };
};

export const approveDealerRecord = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    status: 'approved',
    approved: true,
    isActive: true,
    approvedAt: serverTimestamp(),
    rejectedAt: null,
    rejectionReason: null,
    isDeleted: false,
    deletedAt: null,
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(dealerRef);
  return normalizeDealerStatus({ id: snapshot.id, ...(snapshot.data() as DealerDocument) });
};

export const rejectDealerRecord = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    status: 'rejected',
    approved: false,
    isActive: false,
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(dealerRef);
  return normalizeDealerStatus({ id: snapshot.id, ...(snapshot.data() as DealerDocument) });
};

export const deactivateDealerRecord = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(dealerRef);
  return normalizeDealerStatus({ id: snapshot.id, ...(snapshot.data() as DealerDocument) });
};

export const reactivateDealerRecord = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    status: 'approved',
    approved: true,
    isActive: true,
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(dealerRef);
  return normalizeDealerStatus({ id: snapshot.id, ...(snapshot.data() as DealerDocument) });
};

export const softDeleteDealerRecord = async (id: string): Promise<Dealer> => {
  const dealerRef = doc(dealersCollection, id);
  await updateDoc(dealerRef, {
    status: 'deleted',
    approved: false,
    isActive: false,
    isDeleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(dealerRef);
  return normalizeDealerStatus({ id: snapshot.id, ...(snapshot.data() as DealerDocument) });
};

export const subscribeToDealers = (
  options: SubscriptionOptions<Dealer>,
): Unsubscribe => {
  const dealersQuery = query(dealersCollection, orderBy('name', 'asc'));
  return subscribeToCollection(dealersQuery, mapDealers, options);
};

export const subscribeToApprovedDealers = (
  options: SubscriptionOptions<Dealer>,
): Unsubscribe => {
  const dealersQuery = query(dealersCollection, where('approved', '==', true));
  return subscribeToCollection(
    dealersQuery,
    snapshot =>
      sortDealersByName(
        mapDealers(snapshot).filter(dealer => dealer.isDeleted !== true && dealer.isActive !== false),
      ),
    options,
  );
};

export const subscribeToDealersByOwner = (
  ownerUid: string,
  options: SubscriptionOptions<Dealer>,
): Unsubscribe => {
  const dealersQuery = query(dealersCollection, where('ownerUid', '==', ownerUid));
  return subscribeToCollection(dealersQuery, mapDealers, options);
};

export const listModels = async (): Promise<Model[]> => {
  const snapshot = await getDocs(query(modelsCollection));
  return sortModels(mapModels(snapshot));
};

export const getModelById = async (id: string): Promise<Model | null> => {
  const snapshot = await getDoc(doc(modelsCollection, id));
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<Model, 'id'>) };
};

export const createModel = async (payload: Omit<Model, 'id'>): Promise<Model> => {
  const sanitizedPayload = omitUndefined(payload as Record<string, unknown>);
  const docRef = await addDoc(modelsCollection, {
    ...sanitizedPayload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(docRef);
  return { id: snapshot.id, ...(snapshot.data() as Omit<Model, 'id'>) };
};

export const updateModel = async (id: string, updates: Partial<Omit<Model, 'id'>>): Promise<Model> => {
  const modelRef = doc(modelsCollection, id);
  const sanitizedUpdates = omitUndefined(updates as Record<string, unknown>);
  await updateDoc(modelRef, { ...sanitizedUpdates, updatedAt: serverTimestamp() });
  const snapshot = await getDoc(modelRef);
  return { id: snapshot.id, ...(snapshot.data() as Omit<Model, 'id'>) };
};

export const deleteModel = async (id: string): Promise<void> => {
  await deleteDoc(doc(modelsCollection, id));

  const linksSnapshot = await getDocs(query(dealerModelsCollection, where('model_id', '==', id)));
  const deletions = linksSnapshot.docs.map(link => deleteDoc(link.ref));
  await Promise.all(deletions);
};

export const subscribeToModels = (
  options: SubscriptionOptions<Model>,
): Unsubscribe => {
  const modelsQuery = query(modelsCollection);
  return subscribeToCollection(
    modelsQuery,
    snapshot => sortModels(mapModels(snapshot)),
    options,
  );
};

export const subscribeToModelsByOwner = (
  ownerUid: string,
  options: SubscriptionOptions<Model>,
): Unsubscribe => {
  const modelsQuery = query(modelsCollection, where('ownerUid', '==', ownerUid));
  return subscribeToCollection(modelsQuery, mapModels, options);
};

export const listBlogPosts = async (): Promise<BlogPost[]> => {
  const snapshot = await getDocs(query(blogPostsCollection));
  return sortBlogPostsByDateDesc(mapBlogPosts(snapshot));
};

export const getBlogPostById = async (id: string): Promise<BlogPost | null> => {
  const snapshot = await getDoc(doc(blogPostsCollection, id));
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<BlogPost, 'id'>) };
};

export const createBlogPost = async (payload: Omit<BlogPost, 'id'>): Promise<BlogPost> => {
  const sanitizedPayload = omitUndefined(payload as Record<string, unknown>);
  const docRef = await addDoc(blogPostsCollection, {
    ...sanitizedPayload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(docRef);
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = snapshot.data() as Record<string, unknown>;

  return { id: snapshot.id, ...(rest as Omit<BlogPost, 'id'>) };
};

export const updateBlogPost = async (id: string, updates: Partial<BlogPost>): Promise<BlogPost> => {
  const postRef = doc(blogPostsCollection, id);
  const sanitizedUpdates = omitUndefined(updates as Record<string, unknown>);
  await updateDoc(postRef, { ...sanitizedUpdates, updatedAt: serverTimestamp() });
  const snapshot = await getDoc(postRef);
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = snapshot.data() as Record<string, unknown>;
  return { id: snapshot.id, ...(rest as Omit<BlogPost, 'id'>) };
};

export const deleteBlogPost = async (id: string): Promise<void> => {
  await deleteDoc(doc(blogPostsCollection, id));
};

export const subscribeToBlogPosts = (
  options: SubscriptionOptions<BlogPost>,
): Unsubscribe => {
  const postsQuery = query(blogPostsCollection, orderBy('date', 'desc'));
  return subscribeToCollection(postsQuery, mapBlogPosts, options);
};

export const subscribeToPublishedBlogPosts = (
  options: SubscriptionOptions<BlogPost>,
): Unsubscribe => {
  const postsQuery = query(blogPostsCollection, where('published', '==', true));
  return subscribeToCollection(
    postsQuery,
    snapshot => sortBlogPostsByDateDesc(mapBlogPosts(snapshot)),
    options,
  );
};

export const listDealerModels = async (): Promise<DealerModel[]> => {
  const snapshot = await getDocs(dealerModelsCollection);
  return mapDealerModels(snapshot).map(({ id: _id, ...rest }) => rest);
};

export const subscribeToDealerModels = (
  options: SubscriptionOptions<DealerModel>,
): Unsubscribe =>
  onSnapshot(
    dealerModelsCollection,
    snapshot => {
      const mapped = mapDealerModels(snapshot).map(({ id: _id, ...rest }) => rest);
      options.onData(mapped);
    },
    options.onError,
  );

export const subscribeToDealerModelsForDealers = (
  dealerIds: string[],
  options: SubscriptionOptions<DealerModel>,
): Unsubscribe => {
  const uniqueIds = Array.from(new Set(dealerIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    options.onData([]);
    return () => { };
  }

  if (uniqueIds.length === 1) {
    const dealerQuery = query(dealerModelsCollection, where('dealer_id', '==', uniqueIds[0]!));
    return onSnapshot(dealerQuery, snapshot => options.onData(mapDealerModelsWithoutId(snapshot)), options.onError);
  }

  const chunkSize = 10;
  const chunks: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    chunks.push(uniqueIds.slice(index, index + chunkSize));
  }

  const state = new Map<string, DealerModel[]>();

  const emit = () => {
    const combined: DealerModel[] = [];
    state.forEach(models => {
      combined.push(...models);
    });
    options.onData(combined);
  };

  const unsubscribers = chunks.map(chunkIds => {
    const dealerQuery = query(dealerModelsCollection, where('dealer_id', 'in', chunkIds));
    return onSnapshot(
      dealerQuery,
      snapshot => {
        const mapped = mapDealerModelsWithoutId(snapshot);
        const grouped = new Map<string, DealerModel[]>();

        mapped.forEach(model => {
          if (!grouped.has(model.dealer_id)) {
            grouped.set(model.dealer_id, []);
          }
          grouped.get(model.dealer_id)!.push(model);
        });

        chunkIds.forEach(id => {
          const modelsForDealer = grouped.get(id);
          if (modelsForDealer && modelsForDealer.length > 0) {
            state.set(id, modelsForDealer);
          } else {
            state.delete(id);
          }
        });

        emit();
      },
      options.onError,
    );
  });

  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
};

const buildDealerModelId = (dealerId: string, modelId: string) => `${dealerId}_${modelId}`;

export const createDealerModel = async (
  dealerId: string,
  modelId: string,
  createdBy?: string,
): Promise<DealerModel> => {
  const linkRef = doc(dealerModelsCollection, buildDealerModelId(dealerId, modelId));
  const payload = {
    dealer_id: dealerId,
    model_id: modelId,
    createdAt: serverTimestamp(),
    ...(createdBy ? { createdBy } : {}),
  };
  await setDoc(linkRef, omitUndefined(payload as unknown as Record<string, unknown>));
  return { dealer_id: dealerId, model_id: modelId };
};

export const deleteDealerModel = async (dealerId: string, modelId: string): Promise<void> => {
  await deleteDoc(doc(dealerModelsCollection, buildDealerModelId(dealerId, modelId)));
};
