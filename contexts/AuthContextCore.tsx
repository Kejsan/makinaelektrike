import { createContext, useContext } from 'react';
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
import i18n from '../i18n/config';

interface AuthUserLike {
  uid: string;
  email: string | null;
  displayName?: string | null;
}

export interface AuthContextType {
  user: AuthUserLike | null;
  role: UserRole | null;
  profile: UserProfile | null;
  accountType: AccountType | null;
  accountStatus: AccountStatus | null;
  adminRoleIds: AdminRoleId[];
  dealerPlanId: DealerPlanId | null;
  dealerPlan: DealerPlanDefinition | null;
  dealerEntitlements: DealerPlanEntitlements | null;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  registerUser: (email: string, password: string, profile?: Partial<UserProfile>) => Promise<void>;
  registerDealer: (email: string, password: string, profile?: Partial<UserProfile>) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: PermissionKey) => boolean;
  refreshProfile: () => Promise<void>;
}

const noopAsync = async () => undefined;

export const unauthenticatedAuthContext: AuthContextType = {
  user: null,
  role: null,
  profile: null,
  accountType: null,
  accountStatus: null,
  adminRoleIds: [],
  dealerPlanId: null,
  dealerPlan: null,
  dealerEntitlements: null,
  isAdmin: false,
  isMasterAdmin: false,
  loading: false,
  initializing: false,
  error: null,
  registerUser: noopAsync,
  registerDealer: noopAsync,
  login: noopAsync,
  resetPassword: noopAsync,
  logout: noopAsync,
  hasPermission: () => false,
  refreshProfile: noopAsync,
};

export const AuthContext = createContext<AuthContextType>(unauthenticatedAuthContext);

export const useAuth = () => useContext(AuthContext);

export const mapErrorToMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }

  const code = error?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return i18n.t('auth.errors.emailInUse');
    case 'auth/weak-password':
      return i18n.t('auth.errors.weakPassword');
    case 'auth/invalid-email':
      return i18n.t('auth.errors.invalidEmail');
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return i18n.t('auth.errors.invalidCredentials');
    case 'auth/user-disabled':
      return i18n.t('auth.errors.accountDisabled');
    case 'auth/too-many-requests':
      return i18n.t('auth.errors.tooManyRequests');
    case 'auth/network-request-failed':
      return i18n.t('auth.errors.networkFailed');
    default:
      return error?.message || i18n.t('auth.errors.generic');
  }
};
