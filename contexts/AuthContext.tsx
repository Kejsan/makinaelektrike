import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { auth, firestore } from '../services/firebase';
import type {
  AccountStatus,
  AccountType,
  AdminRoleId,
  DealerPlanDefinition,
  DealerPlanEntitlements,
  DealerPlanId,
  PermissionKey,
  UserProfile,
  UserRole,
} from '../types';
import {
  getDealerPlanDefinition,
  getDealerPlanEntitlements,
  hasPermission as hasProfilePermission,
  isAdminProfile,
  isMasterAdminProfile,
  normalizeUserProfile,
} from '../utils/accessControl';
import { AuthContext, mapErrorToMessage, useAuth, type AuthContextType } from './AuthContextCore';

type FirestoreUser = DocumentData & Partial<UserProfile>;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setProfile(null);
        setRole(null);
        return;
      }

      try {
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
          const data = snapshot.data() as FirestoreUser;
          const mergedProfile = normalizeUserProfile(
            { uid: firebaseUser.uid, email: firebaseUser.email },
            data,
          );
          setProfile(mergedProfile);
          setRole(mergedProfile.role);
        } else {
          const fallbackProfile = normalizeUserProfile(
            { uid: firebaseUser.uid, email: firebaseUser.email },
            {
              role: 'user',
              accountType: 'user',
              accountStatus: 'active',
            },
          );
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            role: 'user',
            accountType: 'user',
            accountStatus: 'active',
            status: 'active',
            email: firebaseUser.email,
            createdAt: serverTimestamp(),
          });
          setProfile(fallbackProfile);
          setRole('user');
        }
      } catch (fetchError) {
        console.error('Failed to load user profile', fetchError);
        setError(i18n.t('auth.errors.profileLoad'));
        setProfile(null);
        setRole(null);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setError(null);

      await loadProfile(currentUser);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, [loadProfile]);

  const registerUser = useCallback<
    AuthContextType['registerUser']
  >(async (email, password, profileData = {}) => {
    setLoading(true);
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const userRef = doc(firestore, 'users', credential.user.uid);
      await setDoc(userRef, {
        uid: credential.user.uid,
        email: credential.user.email,
        role: 'user',
        accountType: 'user',
        accountStatus: 'active',
        status: 'active',
        createdAt: serverTimestamp(),
        ...profileData,
      });
      await loadProfile(credential.user);
    } catch (registerError) {
      const message = mapErrorToMessage(registerError);
      setError(message);
      throw registerError;
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  const registerDealer = useCallback<
    AuthContextType['registerDealer']
  >(async (email, password, profileData = {}) => {
    setLoading(true);
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const userUid = credential.user.uid;
      
      // 1. Create User Document
      const userRef = doc(firestore, 'users', userUid);
      const userData = {
        uid: userUid,
        email: credential.user.email,
        role: 'pending',
        accountType: 'dealer',
        accountStatus: 'pending',
        status: 'pending',
        dealerPlanId: 'free',
        dealerSubscriptionStatus: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...profileData,
      };
      await setDoc(userRef, userData);

      // 2. Create Dealer Document (Linked to the user)
      // Check if profileData contains dealer specific fields
      const { 
        companyName, 
        contactName, 
        phone, 
        city, 
        website, 
        notes,
        termsAccepted,
        privacyAccepted,
        platformRulesAccepted,
        dealerAuthorityAccepted,
        consentVersion,
        termsAcceptedAt,
        privacyAcceptedAt,
        platformRulesAcceptedAt,
        dealerAuthorityAcceptedAt,
      } = profileData as any;

      const dealerRef = doc(firestore, 'dealers', userUid);
      const dealerData = {
        uid: userUid,
        ownerUid: userUid,
        createdBy: userUid,
        updatedBy: userUid,
        name: companyName || '',
        companyName: companyName || '',
        contactName: contactName || '',
        phone: phone || '',
        city: city || '',
        website: website || '',
        notes: notes || '',
        termsAccepted: termsAccepted === true,
        privacyAccepted: privacyAccepted === true,
        platformRulesAccepted: platformRulesAccepted === true,
        dealerAuthorityAccepted: dealerAuthorityAccepted === true,
        consentVersion: consentVersion || null,
        termsAcceptedAt: termsAcceptedAt || null,
        privacyAcceptedAt: privacyAcceptedAt || null,
        platformRulesAcceptedAt: platformRulesAcceptedAt || null,
        dealerAuthorityAcceptedAt: dealerAuthorityAcceptedAt || null,
        contact_email: email,
        contact_phone: phone || '',
        location: city || null,
        description: notes || null,
        approved: false,
        status: 'pending',
        isActive: false,
        isDeleted: false,
        planId: 'free',
        subscriptionStatus: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(dealerRef, dealerData);

      await loadProfile(credential.user);
    } catch (registerError) {
      const message = mapErrorToMessage(registerError);
      setError(message);
      throw registerError;
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await loadProfile(credential.user);
    } catch (loginError) {
      const message = mapErrorToMessage(loginError);
      setError(message);
      throw loginError;
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  const resetPassword = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (resetError) {
      const message = mapErrorToMessage(resetError);
      setError(message);
      throw resetError;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await signOut(auth);
      setProfile(null);
      setRole(null);
    } catch (logoutError) {
      const message = mapErrorToMessage(logoutError);
      setError(message);
      throw logoutError;
    } finally {
      setLoading(false);
    }
  }, []);


  const refreshProfile = useCallback(async () => {
    await loadProfile(auth.currentUser);
  }, [loadProfile]);

  const accountType = profile?.accountType ?? null;
  const accountStatus = profile?.accountStatus ?? null;
  const adminRoleIds = profile?.adminRoleIds ?? [];
  const dealerPlanId = profile?.dealerPlanId ?? null;
  const dealerPlan = useMemo(() => getDealerPlanDefinition(dealerPlanId), [dealerPlanId]);
  const dealerEntitlements = useMemo(
    () => getDealerPlanEntitlements(dealerPlanId),
    [dealerPlanId],
  );
  const isAdmin = useMemo(() => isAdminProfile(profile), [profile]);
  const isMasterAdmin = useMemo(() => isMasterAdminProfile(profile), [profile]);
  const hasPermission = useCallback(
    (permission: PermissionKey) => hasProfilePermission(profile, permission),
    [profile],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role,
      profile,
      accountType,
      accountStatus,
      adminRoleIds,
      dealerPlanId,
      dealerPlan,
      dealerEntitlements,
      isAdmin,
      isMasterAdmin,
      loading,
      initializing,
      error,
      registerUser,
      registerDealer,
      login,
      resetPassword,
      logout,
      hasPermission,
      refreshProfile,
    }),
    [
      accountStatus,
      accountType,
      adminRoleIds,
      dealerEntitlements,
      dealerPlan,
      dealerPlanId,
      error,
      hasPermission,
      initializing,
      isAdmin,
      isMasterAdmin,
      loading,
      login,
      logout,
      profile,
      registerDealer,
      registerUser,
      resetPassword,
      refreshProfile,
      role,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext, mapErrorToMessage, useAuth };
