import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { FavouriteEntry, UserRole } from '../types';

const FAVORITES_KEY = 'makinaElektrikeFavorites_v2';
const LEGACY_FAVORITES_KEY = 'makinaElektrikeFavorites';

type LocalFavorite = { itemId: string; collection: string };

const readLocalFavorites = (): LocalFavorite[] => {
  try {
    // Try reading v2 first
    const storedFavorites = localStorage.getItem(FAVORITES_KEY);
    if (storedFavorites) {
      const parsed = JSON.parse(storedFavorites);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is LocalFavorite => typeof v === 'object' && v !== null && 'itemId' in v);
      }
    }

    // Migration from legacy
    const legacyFavorites = localStorage.getItem(LEGACY_FAVORITES_KEY);
    if (legacyFavorites) {
      const parsed = JSON.parse(legacyFavorites);
      if (Array.isArray(parsed)) {
        const migrated = parsed
          .filter((v): v is string => typeof v === 'string')
          .map(itemId => ({ itemId, collection: 'models' })); // Default to models for legacy
        writeLocalFavorites(migrated);
        // localStorage.removeItem(LEGACY_FAVORITES_KEY); // Optional: keep for safety or remove
        return migrated;
      }
    }

    return [];
  } catch (error) {
    console.error('Error reading favorites from localStorage', error);
    return [];
  }
};

const writeLocalFavorites = (favorites: LocalFavorite[]) => {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving favorites to localStorage', error);
  }
};

const favouritesCollection = (uid: string) => collection(firestore, 'users', uid, 'favourites');

export const useFavorites = () => {
  const { user, initializing, role } = useAuth();
  const { addToast } = useToast();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [entries, setEntries] = useState<FavouriteEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (initializing) {
      return () => undefined;
    }

    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    if (!user) {
      const localFavorites = readLocalFavorites();
      setFavorites(localFavorites.map(f => f.itemId));
      setEntries(
        localFavorites.map<FavouriteEntry>((fav) => ({
          id: fav.itemId,
          itemId: fav.itemId,
          userId: 'local-user',
          role: null,
          createdAt: null,
          updatedAt: null,
          collection: fav.collection,
        })),
      );
      setLoading(false);
      return () => undefined;
    }

    setLoading(true);
    const collectionRef = favouritesCollection(user.uid);

    const unsubscribe = onSnapshot(
      collectionRef,
      snapshot => {
        const remoteEntries = snapshot.docs.map<FavouriteEntry>(docSnapshot => {
          const data = docSnapshot.data() as Partial<FavouriteEntry> | undefined;
          return {
            id: docSnapshot.id,
            itemId: data?.itemId ?? docSnapshot.id,
            userId: data?.userId ?? user.uid,
            role: (data?.role as UserRole | null | undefined) ?? role ?? null,
            createdAt: data?.createdAt ?? null,
            updatedAt: data?.updatedAt ?? null,
            collection: data?.collection || 'models', // Default to models if missing
          };
        });
        const remoteFavorites = remoteEntries.map(entry => entry.itemId);
        setEntries(remoteEntries);
        setFavorites(remoteFavorites);
        
        // Sync local storage v2
        const localFormat = remoteEntries.map(e => ({ itemId: e.itemId, collection: e.collection || 'models' }));
        writeLocalFavorites(localFormat);
        
        setLoading(false);
      },
      (error: FirestoreError) => {
        console.error('Failed to subscribe to favourites', error);
        addToast('Failed to load favourites. Showing local data.', 'error');
        const localFavorites = readLocalFavorites();
        setFavorites(localFavorites.map(f => f.itemId));
        setEntries(
          localFavorites.map<FavouriteEntry>((fav) => ({
            id: fav.itemId,
            itemId: fav.itemId,
            userId: 'local-user',
            role: null,
            createdAt: null,
            updatedAt: null,
            collection: fav.collection,
          })),
        );
        setLoading(false);
      },
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [addToast, initializing, user, role]);

  useEffect(() => () => {
    unsubscribeRef.current?.();
  }, []);

  const toggleFavorite = useCallback(
    async (itemId: string, collectionName: string = 'models') => {
      const wasFavorite = favorites.includes(itemId);
      const previousFavorites = [...favorites];
      const previousEntries = [...entries];
      
      const optimisticFavorites = wasFavorite
        ? favorites.filter(id => id !== itemId)
        : [...favorites, itemId];

      setFavorites(optimisticFavorites);
      setEntries(prev =>
        wasFavorite
          ? prev.filter(entry => entry.itemId !== itemId)
          : [
              ...prev,
              {
                id: itemId,
                itemId: itemId,
                userId: user?.uid ?? 'local-user',
                role: role ?? null,
                createdAt: null,
                updatedAt: null,
                collection: collectionName,
              },
            ],
      );

      if (!user) {
        const localFavorites = wasFavorite
          ? readLocalFavorites().filter(f => f.itemId !== itemId)
          : [...readLocalFavorites(), { itemId, collection: collectionName }];
        writeLocalFavorites(localFavorites);
        return;
      }

      const favouriteRef = doc(favouritesCollection(user.uid), itemId);

      try {
        if (wasFavorite) {
          await deleteDoc(favouriteRef);
        } else {
          const payload: any = {
            itemId: itemId,
            userId: user.uid,
            collection: collectionName,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          };

          if (role) {
            payload.role = role;
          }

          await setDoc(favouriteRef, payload);
        }
      } catch (error) {
        console.error('Failed to toggle favourite', error);
        setFavorites(previousFavorites);
        setEntries(previousEntries);
        addToast('Unable to update favourites. Please try again.', 'error');
      }
    },
    [addToast, entries, favorites, role, user],
  );

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );

  return { favorites, entries, isFavorite, toggleFavorite, loading };
};
