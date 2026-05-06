import type { DocumentData } from 'firebase-admin/firestore';
import type { DealerStaffRole, UserProfile } from '../../../types';
import { getDealerPlanDefinition, hasPermission } from '../../../utils/accessControl';
import { getAdminFirestore } from './firebaseAdmin';
import { isInviteExpired } from './invites';

const isAdminDealerOperator = (profile: UserProfile) =>
  hasPermission(profile, 'dealers.manage_staff') ||
  hasPermission(profile, 'dealers.edit') ||
  hasPermission(profile, 'dealers.approve');

const isDealerOwner = (profile: UserProfile, dealerId: string, dealerData: Record<string, unknown>) =>
  profile.role === 'dealer' &&
  profile.accountType !== 'dealer_staff' &&
  (profile.uid === dealerId || profile.uid === dealerData.ownerUid);

const getDealerStaffRole = (profile: UserProfile): DealerStaffRole | null =>
  typeof profile.dealerStaffRole === 'string' ? profile.dealerStaffRole : null;

const isDealerStaffMember = (profile: UserProfile, dealerId: string) =>
  profile.accountType === 'dealer_staff' && profile.dealerId === dealerId;

const isDealerStaffManager = (profile: UserProfile, dealerId: string) => {
  const role = getDealerStaffRole(profile);
  return isDealerStaffMember(profile, dealerId) && (role === 'owner' || role === 'manager');
};

const isDealerStaffOperator = (profile: UserProfile, dealerId: string) =>
  isDealerStaffMember(profile, dealerId) &&
  (getDealerStaffRole(profile) === 'owner' ||
    getDealerStaffRole(profile) === 'manager' ||
    getDealerStaffRole(profile) === 'editor');

export interface DealerAccessContext {
  dealerId: string;
  dealerData: Record<string, unknown>;
  isAdminOperator: boolean;
  isOwner: boolean;
  isStaffManager: boolean;
  isStaffOperator: boolean;
}

export const requireDealerAccess = async (
  profile: UserProfile,
  dealerId: string,
  options: { requireTeamManagement?: boolean } = {},
): Promise<DealerAccessContext> => {
  const firestore = getAdminFirestore();
  const dealerSnapshot = await firestore.collection('dealers').doc(dealerId).get();
  if (!dealerSnapshot.exists) {
    throw new Error('Dealer record was not found.');
  }

  const dealerData = (dealerSnapshot.data() ?? {}) as DocumentData;
  const isAdminOperator = isAdminDealerOperator(profile);
  const owner = isDealerOwner(profile, dealerId, dealerData);
  const staffManager = isDealerStaffManager(profile, dealerId);
  const staffOperator = isDealerStaffOperator(profile, dealerId);

  const hasAccess = options.requireTeamManagement
    ? isAdminOperator || owner || staffManager
    : isAdminOperator || owner || staffOperator || staffManager;

  if (!hasAccess) {
    throw new Error('You do not have dealer access for this record.');
  }

  return {
    dealerId,
    dealerData,
    isAdminOperator,
    isOwner: owner,
    isStaffManager: staffManager,
    isStaffOperator: staffOperator || staffManager,
  };
};

const isTeamAccountStatusActive = (status: unknown) => status === 'active' || status === 'approved';

export interface DealerTeamCapacity {
  maxTeamAccounts: number;
  ownerCount: number;
  activeStaffCount: number;
  pendingInviteCount: number;
  remainingSlots: number;
}

export const getDealerTeamCapacity = async (
  dealerId: string,
  dealerData: Record<string, unknown>,
): Promise<DealerTeamCapacity> => {
  const firestore = getAdminFirestore();
  const planId = (typeof dealerData.planId === 'string' ? dealerData.planId : 'free') as 'free' | 'paid';
  const maxTeamAccounts = getDealerPlanDefinition(planId)?.entitlements.maxStaffAccounts ?? 1;
  const ownerCount = dealerData.ownerUid || dealerData.uid ? 1 : 0;

  const staffSnapshot = await firestore
    .collection('users')
    .where('dealerId', '==', dealerId)
    .where('accountType', '==', 'dealer_staff')
    .get();
  const activeStaffCount = staffSnapshot.docs.filter(doc =>
    isTeamAccountStatusActive((doc.data() as DocumentData).accountStatus ?? (doc.data() as DocumentData).status),
  ).length;

  const pendingInviteSnapshot = await firestore
    .collection('accessInvites')
    .where('dealerId', '==', dealerId)
    .where('type', '==', 'dealer_staff')
    .where('status', '==', 'pending')
    .get();
  const pendingInviteCount = pendingInviteSnapshot.docs.filter(doc =>
    !isInviteExpired(doc.data() as Record<string, unknown>),
  ).length;

  const usedSlots = ownerCount + activeStaffCount + pendingInviteCount;
  return {
    maxTeamAccounts,
    ownerCount,
    activeStaffCount,
    pendingInviteCount,
    remainingSlots: Math.max(0, maxTeamAccounts - usedSlots),
  };
};

export const listDealerStaffUsers = async (dealerId: string) => {
  const firestore = getAdminFirestore();
  const snapshot = await firestore
    .collection('users')
    .where('dealerId', '==', dealerId)
    .where('accountType', '==', 'dealer_staff')
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data() as DocumentData;
    return {
      uid: doc.id,
      email: typeof data.email === 'string' ? data.email : null,
      displayName: typeof data.displayName === 'string' ? data.displayName : null,
      accountStatus:
        typeof data.accountStatus === 'string'
          ? data.accountStatus
          : typeof data.status === 'string'
            ? data.status
            : null,
      dealerStaffRole: typeof data.dealerStaffRole === 'string' ? data.dealerStaffRole : null,
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    };
  });
};
