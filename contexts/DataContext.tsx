import React, {
  createContext,
  useReducer,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import type {
  Dealer,
  DealerDocument,
  Model,
  BlogPost,
  DealerModel,
  DealerStatus,
  Listing,
  Enquiry,
} from '../types';
import {
  subscribeToListings,
  subscribeToApprovedListings,
  subscribeToListingsByDealer,
  createListing as apiCreateListing,
  updateListing as apiUpdateListing,
  deleteListing as apiDeleteListing,
  approveListing as apiApproveListing,
} from '../services/listings';
import {
  subscribeToDealerEnquiries,
} from '../services/enquiries';
import {
  subscribeToDealers,
  subscribeToApprovedDealers,
  subscribeToModels,
  subscribeToBlogPosts,
  subscribeToPublishedBlogPosts,
  subscribeToDealerModels,
  subscribeToDealersByOwner,
  subscribeToModelsByOwner,
  subscribeToDealerModelsForDealers,
  createDealer as apiCreateDealer,
  updateDealer as apiUpdateDealer,
  deleteDealer as apiDeleteDealer,
  approveDealerStatus as apiApproveDealerStatus,
  rejectDealerStatus as apiRejectDealerStatus,
  deactivateDealerStatus as apiDeactivateDealerStatus,
  reactivateDealerStatus as apiReactivateDealerStatus,
  createModel as apiCreateModel,
  updateModel as apiUpdateModel,
  deleteModel as apiDeleteModel,
  createBlogPost as apiCreateBlogPost,
  updateBlogPost as apiUpdateBlogPost,
  deleteBlogPost as apiDeleteBlogPost,
  createDealerModel as apiCreateDealerModel,
  deleteDealerModel as apiDeleteDealerModel,
  approveDealerRecord,
  rejectDealerRecord,
  deactivateDealerRecord,
  reactivateDealerRecord,
  softDeleteDealerRecord,
} from '../services/api';
import { useAuth } from './AuthContext';
import type { UserRole } from '../types';
import { useToast } from './ToastContext';
import type { FirestoreError, Unsubscribe } from 'firebase/firestore';
import blogPostsData from '../data/blogPosts';
import { FirebaseError } from 'firebase/app';
import { addOfflineMutation } from '../services/offlineQueue';

type DealerInput = DealerDocument;
type DealerUpdate = Partial<DealerDocument>;
type ModelInput = Omit<Model, 'id'>;
type ModelUpdate = Partial<Omit<Model, 'id'>>;
type BlogPostInput = Omit<BlogPost, 'id'>;
type BlogPostUpdate = Partial<BlogPost>;
type ListingInput = Omit<Listing, 'id'>;
type ListingUpdate = Partial<Listing>;

export type EntityKey = 'dealers' | 'models' | 'blogPosts' | 'listings' | 'enquiries';
export type Operation = 'create' | 'update' | 'delete';

type MutationFlag = {
  loading: boolean;
  error: string | null;
};

type EntityMutations = Record<Operation, MutationFlag>;

type MutationState = Record<EntityKey, EntityMutations>;

interface DataState {
  dealers: Dealer[];
  models: Model[];
  blogPosts: BlogPost[];
  listings: Listing[];
  enquiries: Enquiry[];
  dealerModels: DealerModel[];
  loadError: string | null;
  loading: boolean;
  loaded: {
    dealers: boolean;
    models: boolean;
    blogPosts: boolean;
    dealerModels: boolean;
    listings: boolean;
    enquiries: boolean;
  };
}

interface DataContextType {
  dealers: Dealer[];
  models: Model[];
  blogPosts: BlogPost[];
  listings: Listing[];
  enquiries: Enquiry[];
  dealerModels: DealerModel[];
  loading: boolean;
  loadError: string | null;
  dealerMutations: EntityMutations;
  modelMutations: EntityMutations;
  blogPostMutations: EntityMutations;
  listingMutations: EntityMutations;
  enquiryMutations: EntityMutations;
  getModelsForDealer: (dealerId: string) => Model[];
  getDealersForModel: (modelId: string) => Dealer[];
  addDealer: (dealer: DealerInput) => Promise<Dealer>;
  updateDealer: (id: string, updates: DealerUpdate) => Promise<Dealer>;
  deleteDealer: (id: string) => Promise<void>;
  deactivateDealer: (id: string) => Promise<Dealer>;
  reactivateDealer: (id: string) => Promise<Dealer>;
  approveDealer: (id: string) => Promise<Dealer>;
  rejectDealer: (id: string) => Promise<Dealer>;
  addModel: (model: ModelInput) => Promise<Model>;
  updateModel: (id: string, updates: ModelUpdate) => Promise<Model>;
  deleteModel: (id: string) => Promise<void>;
  addBlogPost: (post: BlogPostInput) => Promise<BlogPost>;
  updateBlogPost: (id: string, updates: BlogPostUpdate) => Promise<BlogPost>;
  deleteBlogPost: (id: string) => Promise<void>;
  addListing: (listing: ListingInput) => Promise<Listing>;
  updateListing: (id: string, updates: ListingUpdate) => Promise<Listing>;
  deleteListing: (id: string) => Promise<void>;
  approveListing: (id: string) => Promise<Listing>;
  linkModelToDealer: (dealerId: string, modelId: string) => Promise<DealerModel>;
  unlinkModelFromDealer: (dealerId: string, modelId: string) => Promise<{ dealer_id: string; model_id: string }>;
}

const createMutationFlag = (): MutationFlag => ({ loading: false, error: null });

const createEntityMutations = (): EntityMutations => ({
  create: createMutationFlag(),
  update: createMutationFlag(),
  delete: createMutationFlag(),
});

const createInitialMutationState = (): MutationState => ({
  dealers: createEntityMutations(),
  models: createEntityMutations(),
  blogPosts: createEntityMutations(),
  listings: createEntityMutations(),
  enquiries: createEntityMutations(),
});

type MutationAction =
  | { type: 'start'; entity: EntityKey; operation: Operation }
  | { type: 'success'; entity: EntityKey; operation: Operation }
  | { type: 'error'; entity: EntityKey; operation: Operation; error: string };

type DataAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'SET_DEALERS'; payload: Dealer[] }
  | { type: 'SET_MODELS'; payload: Model[] }
  | { type: 'SET_BLOG_POSTS'; payload: BlogPost[] }
  | { type: 'SET_DEALER_MODELS'; payload: DealerModel[] }
  | { type: 'SET_LISTINGS'; payload: Listing[] }
  | { type: 'SET_ENQUIRIES'; payload: Enquiry[] };

const areCollectionsLoaded = (loaded: DataState['loaded']) =>
  loaded.dealers && loaded.models && loaded.blogPosts && loaded.dealerModels && loaded.listings && loaded.enquiries;

const mutationReducer = (state: MutationState, action: MutationAction): MutationState => {
  const entityState = state[action.entity];

  switch (action.type) {
    case 'start':
      return {
        ...state,
        [action.entity]: {
          ...entityState,
          [action.operation]: { loading: true, error: null },
        },
      };
    case 'success':
      return {
        ...state,
        [action.entity]: {
          ...entityState,
          [action.operation]: { loading: false, error: null },
        },
      };
    case 'error':
      return {
        ...state,
        [action.entity]: {
          ...entityState,
          [action.operation]: { loading: false, error: action.error },
        },
      };
    default:
      return state;
  }
};

const dataReducer = (state: DataState, action: DataAction): DataState => {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, loadError: null };
    case 'LOAD_ERROR':
      return { ...state, loading: false, loadError: action.payload };
    case 'SET_DEALERS': {
      const loaded = { ...state.loaded, dealers: true };
      return {
        ...state,
        dealers: action.payload || [],
        loaded,
        loading: !areCollectionsLoaded(loaded),
      };
    }
    case 'SET_MODELS': {
      const loaded = { ...state.loaded, models: true };
      return {
        ...state,
        models: action.payload || [],
        loaded,
        loading: !areCollectionsLoaded(loaded),
      };
    }
    case 'SET_BLOG_POSTS': {
      const loaded = { ...state.loaded, blogPosts: true };
      return {
        ...state,
        blogPosts: action.payload || [],
        loaded,
        loading: !areCollectionsLoaded(loaded),
      };
    }
    case 'SET_DEALER_MODELS': {
      const loaded = { ...state.loaded, dealerModels: true };
      return {
        ...state,
        dealerModels: action.payload || [],
        loaded,
        loading: !areCollectionsLoaded(loaded),
      };
    }
    case 'SET_LISTINGS': {
      const loaded = { ...state.loaded, listings: true };
      return {
        ...state,
        listings: action.payload || [],
        loaded,
        loading: !areCollectionsLoaded(loaded),
      };
    }
    case 'SET_ENQUIRIES': {
      const loaded = { ...state.loaded, enquiries: true };
      return {
        ...state,
        enquiries: action.payload || [],
        loaded,
        loading: !areCollectionsLoaded(loaded),
      };
    }
    default:
      return state;
  }
};

const rejectUsage = async () => {
  throw new Error('DataProvider not initialized');
};

const defaultMutationState = createInitialMutationState();

const normalizeOptionalString = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const enhanceOwnershipMetadata = <T extends Record<string, unknown>>(
  input: T,
  actorUid: string | undefined,
  keys: { ownerUid?: keyof T; createdBy?: keyof T; updatedBy?: keyof T },
): T => {
  const payload = { ...input };

  const ownerKey = keys.ownerUid;
  const createdKey = keys.createdBy;
  const updatedKey = keys.updatedBy;

  const existingOwner = ownerKey ? normalizeOptionalString(payload[ownerKey] as string | undefined) : undefined;
  const ownerUid = existingOwner ?? actorUid;

  if (ownerKey && ownerUid) {
    payload[ownerKey] = ownerUid as T[keyof T];
  }

  const existingCreated = createdKey ? normalizeOptionalString(payload[createdKey] as string | undefined) : undefined;
  const createdBy = existingCreated ?? ownerUid ?? actorUid;

  if (createdKey && createdBy) {
    payload[createdKey] = createdBy as T[keyof T];
  }

  const existingUpdated = updatedKey ? normalizeOptionalString(payload[updatedKey] as string | undefined) : undefined;
  const updatedBy = existingUpdated ?? actorUid ?? createdBy ?? ownerUid;

  if (updatedKey && updatedBy) {
    payload[updatedKey] = updatedBy as T[keyof T];
  }

  return payload;
};

export const DataContext = createContext<DataContextType>({
  dealers: [],
  models: [],
  blogPosts: [],
  dealerModels: [],
  listings: [],
  enquiries: [],
  loading: true,
  loadError: null,
  dealerMutations: defaultMutationState.dealers,
  modelMutations: defaultMutationState.models,
  blogPostMutations: defaultMutationState.blogPosts,
  listingMutations: defaultMutationState.listings,
  enquiryMutations: defaultMutationState.enquiries,
  getModelsForDealer: () => [],
  getDealersForModel: () => [],
  addDealer: rejectUsage as DataContextType['addDealer'],
  updateDealer: rejectUsage as DataContextType['updateDealer'],
  deleteDealer: rejectUsage as DataContextType['deleteDealer'],
  deactivateDealer: rejectUsage as DataContextType['deactivateDealer'],
  reactivateDealer: rejectUsage as DataContextType['reactivateDealer'],
  approveDealer: rejectUsage as DataContextType['approveDealer'],
  rejectDealer: rejectUsage as DataContextType['rejectDealer'],
  addModel: rejectUsage as DataContextType['addModel'],
  updateModel: rejectUsage as DataContextType['updateModel'],
  deleteModel: rejectUsage as DataContextType['deleteModel'],
  addBlogPost: rejectUsage as DataContextType['addBlogPost'],
  updateBlogPost: rejectUsage as DataContextType['updateBlogPost'],
  deleteBlogPost: rejectUsage as DataContextType['deleteBlogPost'],
  addListing: rejectUsage as DataContextType['addListing'],
  updateListing: rejectUsage as DataContextType['updateListing'],
  deleteListing: rejectUsage as DataContextType['deleteListing'],
  approveListing: rejectUsage as DataContextType['approveListing'],
  linkModelToDealer: rejectUsage as DataContextType['linkModelToDealer'],
  unlinkModelFromDealer: rejectUsage as DataContextType['unlinkModelFromDealer'],
});

interface DataProviderProps {
  children: ReactNode;
}

const isFirebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);

const staticBlogPosts = [...blogPostsData].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
);

const initialDataState: DataState = {
  dealers: [],
  models: [],
  blogPosts: isFirebaseConfigured ? [] : staticBlogPosts,
  listings: [],
  enquiries: [],
  dealerModels: [],
  loadError: null,
  loading: true,
  loaded: {
    dealers: false,
    models: false,
    blogPosts: !isFirebaseConfigured,
    dealerModels: false,
    listings: false,
    enquiries: true, // Default to true, will be set to false for dealers specifically
  },
};

interface MutationRequest<T> {
  entity: EntityKey;
  operation: Operation;
  action: () => Promise<T>;
  successMessage: string;
  errorMessage: string;
  allowedRoles?: UserRole[];
  payloadForExport?: unknown;
}

const permissionErrorCodes = new Set(['permission-denied', 'unauthenticated']);

const shouldPersistOffline = (error: unknown): error is FirebaseError =>
  error instanceof FirebaseError && permissionErrorCodes.has(error.code);

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [dataState, dataDispatch] = useReducer(dataReducer, initialDataState);
  const [mutationState, mutationDispatch] = useReducer(mutationReducer, createInitialMutationState());
  const { role, user } = useAuth();
  const { addToast } = useToast();
  const userUid = user?.uid ?? null;

  const handleSubscriptionError = useCallback(
    (resource: string) => (error: FirestoreError) => {
      console.error(`Failed to subscribe to ${resource}`, error);
      const message = `Failed to load ${resource}. Please try again later.`;
      dataDispatch({ type: 'LOAD_ERROR', payload: message });
      addToast(message, 'error');
    },
    [addToast],
  );

  const permissionAwareErrorHandler = useCallback(
    (resource: string, fallback?: () => void) => (error: FirestoreError) => {
      if (error.code === 'permission-denied') {
        console.warn(`Permission denied while subscribing to ${resource}.`, error);
        fallback?.();
        return;
      }
      handleSubscriptionError(resource)(error);
    },
    [handleSubscriptionError],
  );

  useEffect(() => {
    dataDispatch({ type: 'LOAD_START' });

    const unsubscribers: Unsubscribe[] = [];
    let dealerModelsUnsubscribe: Unsubscribe | null = null;

    const cleanupDealerModelsSubscription = () => {
      if (dealerModelsUnsubscribe) {
        dealerModelsUnsubscribe();
        dealerModelsUnsubscribe = null;
      }
    };

    const setDealerModels = (mappings: DealerModel[]) => {
      dataDispatch({ type: 'SET_DEALER_MODELS', payload: mappings });
    };

    if (role === 'dealer' && userUid) {
      unsubscribers.push(
        subscribeToDealersByOwner(userUid, {
          onData: dealers => {
            dataDispatch({ type: 'SET_DEALERS', payload: dealers });
            cleanupDealerModelsSubscription();

            if (dealers.length > 0) {
              dealerModelsUnsubscribe = subscribeToDealerModelsForDealers(
                dealers.map(dealer => dealer.id),
                {
                  onData: setDealerModels,
                  onError: permissionAwareErrorHandler('dealer relationships', () => setDealerModels([])),
                },
              );
            } else {
              setDealerModels([]);
            }
          },
          onError: permissionAwareErrorHandler('dealers', () => dataDispatch({ type: 'SET_DEALERS', payload: [] })),
        }),
      );

      unsubscribers.push(
        subscribeToModelsByOwner(userUid, {
          onData: models => dataDispatch({ type: 'SET_MODELS', payload: models }),
          onError: permissionAwareErrorHandler('vehicle models', () => dataDispatch({ type: 'SET_MODELS', payload: [] })),
        }),
      );

    } else {
      unsubscribers.push(
        (role === 'admin'
          ? subscribeToDealers({
            onData: dealers => dataDispatch({ type: 'SET_DEALERS', payload: dealers }),
            onError: handleSubscriptionError('dealers'),
          })
          : subscribeToApprovedDealers({
            onData: dealers => dataDispatch({ type: 'SET_DEALERS', payload: dealers }),
            onError: permissionAwareErrorHandler('dealers', () => dataDispatch({ type: 'SET_DEALERS', payload: [] })),
          }))
      );
      unsubscribers.push(
        subscribeToModels({
          onData: models => dataDispatch({ type: 'SET_MODELS', payload: models }),
          onError:
            role === 'admin'
              ? handleSubscriptionError('vehicle models')
              : permissionAwareErrorHandler('vehicle models', () =>
                dataDispatch({ type: 'SET_MODELS', payload: [] }),
              ),
        }),
      );

      if (role === 'admin') {
        unsubscribers.push(
          subscribeToDealerModels({
            onData: mappings => setDealerModels(mappings),
            onError: handleSubscriptionError('dealer relationships'),
          }),
        );
      } else {
        setDealerModels([]);
      }

      unsubscribers.push(
        (role === 'admin'
          ? subscribeToListings({
            onData: listings => dataDispatch({ type: 'SET_LISTINGS', payload: listings }),
            onError: handleSubscriptionError('listings'),
          })
          : subscribeToApprovedListings({
            onData: listings => dataDispatch({ type: 'SET_LISTINGS', payload: listings }),
            onError: permissionAwareErrorHandler('listings', () => dataDispatch({ type: 'SET_LISTINGS', payload: [] })),
          }))
      );
    }
    if (isFirebaseConfigured) {
      unsubscribers.push(
        (role === 'admin'
          ? subscribeToBlogPosts({
            onData: posts => dataDispatch({ type: 'SET_BLOG_POSTS', payload: posts }),
            onError: permissionAwareErrorHandler('blog posts', () =>
              dataDispatch({ type: 'SET_BLOG_POSTS', payload: staticBlogPosts }),
            ),
          })
          : subscribeToPublishedBlogPosts({
            onData: posts => dataDispatch({ type: 'SET_BLOG_POSTS', payload: posts }),
            onError: permissionAwareErrorHandler('blog posts', () =>
              dataDispatch({ type: 'SET_BLOG_POSTS', payload: staticBlogPosts }),
            ),
          }))
      );
    } else {
      dataDispatch({ type: 'SET_BLOG_POSTS', payload: staticBlogPosts });
    }

    return () => {
      cleanupDealerModelsSubscription();
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [
    handleSubscriptionError,
    permissionAwareErrorHandler,
    role,
    userUid,
  ]);

  useEffect(() => {
    if (role !== 'dealer') {
      return;
    }

    const dealerIds = dataState.dealers.map(dealer => dealer.id);

    if (dealerIds.length === 0) {
      dataDispatch({ type: 'SET_LISTINGS', payload: [] });
      return;
    }

    const uniqueIds = Array.from(new Set(dealerIds));
    const aggregatedListings = new Map<string, Listing[]>();

    const unsubscribers = uniqueIds.map((dealerId: string) =>
      subscribeToListingsByDealer(dealerId, {
        onData: listings => {
          aggregatedListings.set(dealerId, listings);
          const combined = Array.from(aggregatedListings.values()).flat();
          dataDispatch({ type: 'SET_LISTINGS', payload: combined });
        },
        onError: permissionAwareErrorHandler('listings', () => {
          aggregatedListings.delete(dealerId);
          const combined = Array.from(aggregatedListings.values()).flat();
          dataDispatch({ type: 'SET_LISTINGS', payload: combined });
        }),
      }),
    );

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [dataState.dealers, permissionAwareErrorHandler, role]);

  useEffect(() => {
    if (role !== 'dealer' || !userUid) {
      return;
    }

    const unsub = subscribeToDealerEnquiries(userUid, {
      onData: (enquiries: Enquiry[]) => dataDispatch({ type: 'SET_ENQUIRIES', payload: enquiries }),
      onError: permissionAwareErrorHandler('enquiries', () => dataDispatch({ type: 'SET_ENQUIRIES', payload: [] })),
    });

    return () => unsub();
  }, [role, userUid, permissionAwareErrorHandler]);

  useEffect(() => {
    if (role === 'admin' || role === 'dealer') {
      return;
    }

    const dealerIds = dataState.dealers.map(dealer => dealer.id);

    if (dealerIds.length === 0) {
      dataDispatch({ type: 'SET_DEALER_MODELS', payload: [] });
      return;
    }

    const uniqueIds = Array.from(new Set(dealerIds));
    const aggregated = new Map<string, DealerModel[]>();

    const unsubscribers = uniqueIds.map((dealerId: string) =>
      subscribeToDealerModelsForDealers([dealerId], {
        onData: mappings => {
          aggregated.set(dealerId, mappings);
          const combined = Array.from(aggregated.values()).flat();
          dataDispatch({ type: 'SET_DEALER_MODELS', payload: combined });
        },
        onError: permissionAwareErrorHandler('dealer relationships', () => {
          aggregated.delete(dealerId);
          const combined = Array.from(aggregated.values()).flat();
          dataDispatch({ type: 'SET_DEALER_MODELS', payload: combined });
        }) as any,
      }),
    );

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [dataState.dealers, permissionAwareErrorHandler, role]);

  const runMutation = useCallback(
    async <T,>({
      entity,
      operation,
      action,
      successMessage,
      errorMessage,
      allowedRoles = ['admin'],
      payloadForExport,
    }: MutationRequest<T>) => {
      if (!role || !allowedRoles.includes(role)) {
        const permissionMessage = 'You do not have permission to perform this action.';
        mutationDispatch({ type: 'error', entity, operation, error: permissionMessage });
        addToast(permissionMessage, 'error');
        throw new Error(permissionMessage);
      }

      mutationDispatch({ type: 'start', entity, operation });

      try {
        const result = await action();
        mutationDispatch({ type: 'success', entity, operation });
        addToast(successMessage, 'success');
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        mutationDispatch({ type: 'error', entity, operation, error: message });
        addToast(errorMessage, 'error');

        if (payloadForExport && shouldPersistOffline(error)) {
          addOfflineMutation({
            entity,
            operation,
            payload: payloadForExport,
            error: message,
          });
          addToast(
            'Firebase rejected this request. The data was stored in the Offline queue so you can import it manually.',
            'warning',
          );
        }

        throw error;
      }
    },
    [addToast, role],
  );

  const enhanceDealerInput = useCallback(
    (input: DealerInput): DealerInput => {
      const actorUid = normalizeOptionalString(userUid);
      const status = (input.status as DealerStatus | undefined) ?? 'pending';
      const isActive =
        input.isActive === undefined ? (status === 'approved' ? true : input.isActive ?? true) : input.isActive;

      const hydrated: DealerInput = {
        ...input,
        status,
        isActive: isActive,
        approved: status === 'approved',
        contact_email: input.contact_email ?? input.email,
        contact_phone: input.contact_phone ?? input.phone,
        logo_url: input.logo_url ?? input.image_url,
        location: input.location ?? [input.address, input.city].filter(Boolean).join(', '),
      };

      return enhanceOwnershipMetadata(hydrated as unknown as Record<string, unknown>, actorUid, {
        ownerUid: 'ownerUid',
        createdBy: 'createdBy',
        updatedBy: 'updatedBy',
      }) as unknown as DealerInput;
    },
    [userUid],
  );

  const enhanceDealerUpdate = useCallback(
    (updates: DealerUpdate): DealerUpdate => {
      const actorUid = normalizeOptionalString(userUid);
      const { updatedBy, status: rawStatus, isActive: rawIsActive, ...rest } = updates;
      const sanitized: DealerUpdate = { ...rest };

      if (role === 'admin') {
        if (rawStatus !== undefined) {
          const status = (rawStatus as DealerStatus) ?? undefined;
          if (status) {
            sanitized.status = status;
            sanitized.approved = status === 'approved';
          }
        }
        if (rawIsActive !== undefined) {
          sanitized.isActive = rawIsActive;
        }
      }

      const normalizedUpdatedBy = normalizeOptionalString(updatedBy);

      if (normalizedUpdatedBy) {
        return { ...sanitized, updatedBy: normalizedUpdatedBy };
      }

      if (actorUid) {
        return { ...sanitized, updatedBy: actorUid };
      }

      return { ...sanitized };
    },
    [role, userUid],
  );

  const enhanceModelInput = useCallback(
    (input: ModelInput): ModelInput => {
      const actorUid = normalizeOptionalString(userUid);

      const {
        ownerDealerId: rawOwnerDealerId,
        ownerUid: rawOwnerUid,
        createdBy: rawCreatedBy,
        updatedBy: rawUpdatedBy,
        ...rest
      } = input;

      const existingOwnerDealerId = normalizeOptionalString(rawOwnerDealerId);
      const existingOwnerUid = normalizeOptionalString(rawOwnerUid);
      const existingCreatedBy = normalizeOptionalString(rawCreatedBy);
      const existingUpdatedBy = normalizeOptionalString(rawUpdatedBy);

      let derivedOwnerDealerId = existingOwnerDealerId;
      let derivedOwnerUid = existingOwnerUid;

      if (role === 'dealer') {
        const ownedDealers = dataState.dealers;
        const primaryDealer =
          ownedDealers.find(dealer => normalizeOptionalString(dealer.ownerUid) === actorUid) ??
          ownedDealers[0];

        if (!derivedOwnerDealerId && primaryDealer) {
          derivedOwnerDealerId = primaryDealer.id;
        }

        if (!derivedOwnerUid) {
          derivedOwnerUid = normalizeOptionalString(primaryDealer?.ownerUid) ?? actorUid;
        }
      } else if (!derivedOwnerUid) {
        derivedOwnerUid = actorUid;
      }

      const payload: ModelInput = { ...rest } as ModelInput;

      const ownerDealerId = derivedOwnerDealerId ?? existingOwnerDealerId;
      if (ownerDealerId) {
        payload.ownerDealerId = ownerDealerId;
      }

      const ownership = enhanceOwnershipMetadata(payload, actorUid, {
        ownerUid: 'ownerUid',
        createdBy: 'createdBy',
        updatedBy: 'updatedBy',
      });

      return ownership;
    },
    [dataState.dealers, role, userUid],
  );

  const enhanceModelUpdate = useCallback(
    (updates: ModelUpdate): ModelUpdate => {
      const actorUid = normalizeOptionalString(userUid);
      const { updatedBy: rawUpdatedBy, ...rest } = updates;
      const existingUpdatedBy = normalizeOptionalString(rawUpdatedBy);

      if (existingUpdatedBy) {
        return { ...rest, updatedBy: existingUpdatedBy };
      }

      if (actorUid) {
        return { ...rest, updatedBy: actorUid };
      }

      return { ...rest };
    },
    [userUid],
  );

  const enhanceBlogPostInput = useCallback(
    (input: BlogPostInput): BlogPostInput => {
      const actorUid = normalizeOptionalString(userUid);
      const payload = enhanceOwnershipMetadata(input, actorUid, {
        ownerUid: 'ownerUid',
        createdBy: 'createdBy',
        updatedBy: 'updatedBy',
      });

      if (payload.published === undefined) {
        payload.published = true;
      }

      return payload;
    },
    [userUid],
  );

  const enhanceBlogPostUpdate = useCallback(
    (updates: BlogPostUpdate): BlogPostUpdate => {
      const actorUid = normalizeOptionalString(userUid);
      const { updatedBy, ...rest } = updates;
      const normalizedUpdatedBy = normalizeOptionalString(updatedBy);

      if (normalizedUpdatedBy) {
        return { ...rest, updatedBy: normalizedUpdatedBy };
      }

      if (actorUid) {
        return { ...rest, updatedBy: actorUid };
      }

      return { ...rest };
    },
    [userUid],
  );

  const addDealer = useCallback(
    (dealer: DealerInput) => {
      const payload = enhanceDealerInput(dealer);
      return runMutation({
        entity: 'dealers',
        operation: 'create',
        action: () => apiCreateDealer(payload),
        successMessage: 'Dealer created successfully.',
        errorMessage: 'Failed to create dealer.',
        payloadForExport: payload,
      });
    },
    [enhanceDealerInput, runMutation],
  );

  const updateDealer = useCallback(
    (id: string, updates: DealerUpdate) =>
      runMutation({
        entity: 'dealers',
        operation: 'update',
        action: () => apiUpdateDealer(id, enhanceDealerUpdate(updates)),
        successMessage: 'Dealer updated successfully.',
        errorMessage: 'Failed to update dealer.',
        allowedRoles: ['admin', 'dealer'],
      }),
    [enhanceDealerUpdate, runMutation],
  );

  const deleteDealer = useCallback(
    (id: string) =>
      runMutation({
        entity: 'dealers',
        operation: 'delete',
        action: () => softDeleteDealerRecord(id),
        successMessage: 'Dealer deleted successfully.',
        errorMessage: 'Failed to delete dealer.',
        allowedRoles: ['admin'],
      }),
    [runMutation],
  );

  const approveDealer = useCallback(
    (id: string) =>
      runMutation({
        entity: 'dealers',
        operation: 'update',
        action: () => apiApproveDealerStatus(id),
        successMessage: 'Dealer approved successfully.',
        errorMessage: 'Failed to approve dealer.',
        allowedRoles: ['admin'],
      }),
    [runMutation],
  );

  const rejectDealer = useCallback(
    (id: string) =>
      runMutation({
        entity: 'dealers',
        operation: 'update',
        action: () => apiRejectDealerStatus(id),
        successMessage: 'Dealer rejected successfully.',
        errorMessage: 'Failed to reject dealer.',
        allowedRoles: ['admin'],
      }),
    [runMutation],
  );

  const deactivateDealer = useCallback(
    (id: string) =>
      runMutation({
        entity: 'dealers',
        operation: 'update',
        action: () => apiDeactivateDealerStatus(id),
        successMessage: 'Dealer deactivated successfully.',
        errorMessage: 'Failed to deactivate dealer.',
        allowedRoles: ['admin'],
      }),
    [runMutation],
  );

  const reactivateDealer = useCallback(
    (id: string) =>
      runMutation({
        entity: 'dealers',
        operation: 'update',
        action: () => apiReactivateDealerStatus(id),
        successMessage: 'Dealer reactivated successfully.',
        errorMessage: 'Failed to reactivate dealer.',
        allowedRoles: ['admin'],
      }),
    [runMutation],
  );

  const addModel = useCallback(
    (model: ModelInput) => {
      const payload = enhanceModelInput(model);
      return runMutation({
        entity: 'models',
        operation: 'create',
        action: () => apiCreateModel(payload),
        successMessage: 'Model created successfully.',
        errorMessage: 'Failed to create model.',
        allowedRoles: ['admin', 'dealer'],
        payloadForExport: payload,
      });
    },
    [enhanceModelInput, runMutation],
  );

  const updateModel = useCallback(
    (id: string, updates: ModelUpdate) =>
      runMutation({
        entity: 'models',
        operation: 'update',
        action: () => apiUpdateModel(id, enhanceModelUpdate(updates)),
        successMessage: 'Model updated successfully.',
        errorMessage: 'Failed to update model.',
        allowedRoles: ['admin', 'dealer'],
      }),
    [enhanceModelUpdate, runMutation],
  );

  const deleteModel = useCallback(
    (id: string) =>
      runMutation({
        entity: 'models',
        operation: 'delete',
        action: () => apiDeleteModel(id),
        successMessage: 'Model deleted successfully.',
        errorMessage: 'Failed to delete model.',
      }),
    [runMutation],
  );

  const linkModelToDealer = useCallback(
    (dealerId: string, modelId: string) =>
      runMutation({
        entity: 'dealers',
        operation: 'update',
        action: () => apiCreateDealerModel(dealerId, modelId, normalizeOptionalString(userUid)),
        successMessage: 'Model linked to dealer successfully.',
        errorMessage: 'Failed to link model to dealer.',
        allowedRoles: ['admin', 'dealer'],
      }),
    [runMutation, userUid],
  );

  const unlinkModelFromDealer = useCallback(
    (dealerId: string, modelId: string) =>
      runMutation({
        entity: 'dealers',
        operation: 'update',
        action: async () => {
          await apiDeleteDealerModel(dealerId, modelId);
          return { dealer_id: dealerId, model_id: modelId };
        },
        successMessage: 'Model removed from dealer successfully.',
        errorMessage: 'Failed to remove model from dealer.',
        allowedRoles: ['admin', 'dealer'],
      }),
    [runMutation],
  );

  const addBlogPost = useCallback(
    (post: BlogPostInput) => {
      const payload = enhanceBlogPostInput(post);
      return runMutation({
        entity: 'blogPosts',
        operation: 'create',
        action: () => apiCreateBlogPost(payload),
        successMessage: 'Blog post created successfully.',
        errorMessage: 'Failed to create blog post.',
        payloadForExport: payload,
      });
    },
    [enhanceBlogPostInput, runMutation],
  );

  const updateBlogPost = useCallback(
    (id: string, updates: BlogPostUpdate) =>
      runMutation({
        entity: 'blogPosts',
        operation: 'update',
        action: () => apiUpdateBlogPost(id, enhanceBlogPostUpdate(updates)),
        successMessage: 'Blog post updated successfully.',
        errorMessage: 'Failed to update blog post.',
      }),
    [enhanceBlogPostUpdate, runMutation],
  );

  const deleteBlogPost = useCallback(
    (id: string) =>
      runMutation({
        entity: 'blogPosts',
        operation: 'delete',
        action: () => apiDeleteBlogPost(id),
        successMessage: 'Blog post deleted successfully.',
        errorMessage: 'Failed to delete blog post.',
      }),
    [runMutation],
  );

  const enhanceListingInput = useCallback(
    (input: ListingInput): ListingInput => {
      const actorUid = normalizeOptionalString(userUid);
      // We can add ownership metadata enhancement here if needed, similar to models
      // Listing interface has ownerUid
      const payload = { ...input };
      if (actorUid && !payload.ownerUid) {
        payload.ownerUid = actorUid;
      }
      if (!payload.status) {
        payload.status = 'pending';
      }
      return payload as ListingInput;
    },
    [userUid],
  );

  const addListing = useCallback(
    (listing: ListingInput) => {
      const payload = enhanceListingInput(listing);
      return runMutation({
        entity: 'listings',
        operation: 'create',
        action: () => apiCreateListing(payload),
        successMessage: 'Listing created successfully.',
        errorMessage: 'Failed to create listing.',
        allowedRoles: ['admin', 'dealer'],
        payloadForExport: payload,
      });
    },
    [enhanceListingInput, runMutation],
  );

  const updateListing = useCallback(
    (id: string, updates: ListingUpdate) =>
      runMutation({
        entity: 'listings',
        operation: 'update',
        action: () => apiUpdateListing(id, updates),
        successMessage: 'Listing updated successfully.',
        errorMessage: 'Failed to update listing.',
        allowedRoles: ['admin', 'dealer'],
      }),
    [runMutation],
  );

  const deleteListing = useCallback(
    (id: string) =>
      runMutation({
        entity: 'listings',
        operation: 'delete',
        action: () => apiDeleteListing(id),
        successMessage: 'Listing deleted successfully.',
        errorMessage: 'Failed to delete listing.',
        allowedRoles: ['admin', 'dealer'],
      }),
    [runMutation],
  );

  const approveListing = useCallback(
    (id: string) =>
      runMutation({
        entity: 'listings',
        operation: 'update',
        action: () => apiApproveListing(id),
        successMessage: 'Listing approved successfully.',
        errorMessage: 'Failed to approve listing.',
        allowedRoles: ['admin'],
      }),
    [runMutation],
  );

  const { dealers, models, blogPosts, dealerModels, listings, enquiries, loading, loadError } = dataState;

  const dealerToModelMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (dealerModels || []).forEach(({ dealer_id, model_id }) => {
      if (!map.has(dealer_id)) {
        map.set(dealer_id, new Set());
      }
      map.get(dealer_id)!.add(model_id);
    });
    return map;
  }, [dealerModels]);

  const modelToDealerMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (dealerModels || []).forEach(({ dealer_id, model_id }) => {
      if (!map.has(model_id)) {
        map.set(model_id, new Set());
      }
      map.get(model_id)!.add(dealer_id);
    });
    return map;
  }, [dealerModels]);

  const getModelsForDealer = useCallback(
    (dealerId: string) => {
      const modelIds = dealerToModelMap.get(dealerId);
      if (!modelIds) {
        return [];
      }
      return models.filter(model => modelIds.has(model.id));
    },
    [dealerToModelMap, models],
  );

  const getDealersForModel = useCallback(
    (modelId: string) => {
      const dealerIds = modelToDealerMap.get(modelId);
      if (!dealerIds) {
        return [];
      }
      return dealers.filter(dealer => dealerIds.has(dealer.id));
    },
    [dealers, modelToDealerMap],
  );

  const contextValue = useMemo(
    () => ({
      dealers,
      models,
      blogPosts,
      dealerModels,
      listings,
      enquiries,
      loading,
      loadError,
      dealerMutations: mutationState.dealers,
      modelMutations: mutationState.models,
      blogPostMutations: mutationState.blogPosts,
      listingMutations: mutationState.listings,
      getModelsForDealer,
      getDealersForModel,
      addDealer,
      updateDealer,
      deleteDealer,
      deactivateDealer,
      reactivateDealer,
      approveDealer,
      rejectDealer,
      addModel,
      updateModel,
      deleteModel,
      addBlogPost,
      updateBlogPost,
      deleteBlogPost,
      addListing,
      updateListing,
      deleteListing,
      approveListing,
      linkModelToDealer,
      unlinkModelFromDealer,
    }),
    [
      dealers,
      models,
      blogPosts,
      dealerModels,
      listings,
      enquiries,
      loading,
      loadError,
      mutationState.dealers,
      mutationState.models,
      mutationState.blogPosts,
      mutationState.listings,
      getModelsForDealer,
      getDealersForModel,
      addDealer,
      updateDealer,
      deleteDealer,
      deactivateDealer,
      reactivateDealer,
      approveDealer,
      rejectDealer,
      addModel,
      updateModel,
      deleteModel,
      addBlogPost,
      updateBlogPost,
      deleteBlogPost,
      addListing,
      updateListing,
      deleteListing,
      approveListing,
      linkModelToDealer,
      unlinkModelFromDealer,
    ],
  );

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
};
