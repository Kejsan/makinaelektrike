import type { DocumentData } from 'firebase-admin/firestore';
import type { AdminNotification, PermissionKey } from '../../types';
import type { FunctionEvent } from './_lib/http';
import {
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  quotaExceeded,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { isFirestoreQuotaError } from './_lib/firebaseErrors';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { serializeTimestamp } from './_lib/placements';
import { hasPermission } from '../../utils/accessControl';

const MAX_NOTIFICATIONS = 80;

const can = (profile: Parameters<typeof hasPermission>[0], permission: PermissionKey) =>
  hasPermission(profile, permission);

const hasAnyPermission = (
  profile: Parameters<typeof hasPermission>[0],
  permissions: PermissionKey[],
) => permissions.some(permission => hasPermission(profile, permission));

const getString = (data: DocumentData, key: string, fallback = '') => {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const getCreatedAt = (data: DocumentData) =>
  serializeTimestamp(data.createdAt) ?? serializeTimestamp(data.updatedAt);

const buildNotification = (
  notification: Omit<AdminNotification, 'createdAt'> & { createdAt?: string | null },
): AdminNotification => ({
  createdAt: notification.createdAt ?? null,
  ...notification,
});

const sortNotifications = (notifications: AdminNotification[]) =>
  notifications.sort((left, right) => {
    const severityScore = { urgent: 3, attention: 2, info: 1 };
    const severityDelta = severityScore[right.severity] - severityScore[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const leftTime = Date.parse(left.createdAt ?? '') || 0;
    const rightTime = Date.parse(right.createdAt ?? '') || 0;
    return rightTime - leftTime;
  });

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const canReadAnyAdminQueue = hasAnyPermission(profile, [
      'dealers.read',
      'dealers.approve',
      'dealers.manage_staff',
      'listings.read',
      'listings.moderate',
      'models.read',
      'models.publish',
      'placements.read',
      'placements.billing_read',
      'enquiries.read',
      'users.read',
      'stations.read',
      'blog.read',
      'admins.invite',
      'admins.assign_permissions',
    ]);

    if (!canReadAnyAdminQueue) {
      return forbidden('You do not have permission to view admin notifications.');
    }

    const firestore = getAdminFirestore();
    const notifications: AdminNotification[] = [];
    const tasks: Promise<void>[] = [];

    if (hasAnyPermission(profile, ['dealers.read', 'dealers.approve', 'dealers.edit'])) {
      tasks.push(
        firestore
          .collection('dealers')
          .where('status', '==', 'pending')
          .limit(25)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const name = getString(data, 'name', 'Unnamed dealer');
              notifications.push(
                buildNotification({
                  id: `dealer_approval:${doc.id}`,
                  type: 'dealer_approval',
                  severity: 'urgent',
                  title: 'Dealer approval needed',
                  message: `${name} is waiting for approval before the dealer profile can operate normally.`,
                  actionLabel: 'Review dealer',
                  href: `/admin?tab=dealers&dealerFilter=pending&focus=${encodeURIComponent(doc.id)}`,
                  entityType: 'dealer',
                  entityId: doc.id,
                  permissionHint: 'dealers.approve',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    if (hasAnyPermission(profile, ['listings.read', 'listings.moderate'])) {
      tasks.push(
        firestore
          .collection('listings')
          .where('status', '==', 'pending')
          .limit(25)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const title = getString(data, 'title', `${getString(data, 'make')} ${getString(data, 'model')}`.trim()) || 'Untitled listing';
              notifications.push(
                buildNotification({
                  id: `listing_review:${doc.id}`,
                  type: 'listing_review',
                  severity: 'urgent',
                  title: 'Listing moderation needed',
                  message: `${title} is pending admin review before it can be public.`,
                  actionLabel: 'Review listing',
                  href: `/admin?tab=listings&focus=${encodeURIComponent(doc.id)}`,
                  entityType: 'listing',
                  entityId: doc.id,
                  permissionHint: 'listings.moderate',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    if (hasAnyPermission(profile, ['models.read', 'models.publish'])) {
      tasks.push(
        firestore
          .collection('models')
          .where('reviewStatus', '==', 'pending_review')
          .limit(25)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const label = `${getString(data, 'brand')} ${getString(data, 'modelName') || getString(data, 'model')}`.trim() || 'EV model';
              notifications.push(
                buildNotification({
                  id: `model_review:${doc.id}`,
                  type: 'model_review',
                  severity: 'attention',
                  title: 'EV model review needed',
                  message: `${label} has dealer-originated or pending canonical data awaiting review.`,
                  actionLabel: 'Review model',
                  href: `/admin?tab=models&focus=${encodeURIComponent(doc.id)}`,
                  entityType: 'model',
                  entityId: doc.id,
                  permissionHint: 'models.publish',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    if (hasAnyPermission(profile, ['placements.read', 'placements.billing_read', 'placements.edit'])) {
      tasks.push(
        firestore
          .collection('sponsorshipOrders')
          .where('status', 'in', ['draft', 'quoted', 'reserved'])
          .limit(25)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const status = getString(data, 'status', 'draft');
              const paymentStatus = getString(data, 'paymentStatus', 'unpaid');
              const name = getString(data, 'name', 'Promotion request');
              notifications.push(
                buildNotification({
                  id: `sponsorship_request:${doc.id}`,
                  type: 'sponsorship_request',
                  severity: status === 'draft' ? 'urgent' : 'attention',
                  title: 'Promotion request needs handling',
                  message: `${name} is ${status} with payment status ${paymentStatus}. Review quote, inventory, invoice, or campaign linkage.`,
                  actionLabel: 'Open placements',
                  href: `/admin?tab=placements&focus=${encodeURIComponent(doc.id)}`,
                  entityType: 'sponsorship_order',
                  entityId: doc.id,
                  permissionHint: 'placements.billing_read',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    if (can(profile, 'enquiries.read')) {
      tasks.push(
        firestore
          .collection('contactMessages')
          .where('status', '==', 'new')
          .limit(20)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const name = getString(data, 'name', 'Website visitor');
              const email = getString(data, 'email');
              notifications.push(
                buildNotification({
                  id: `contact_message:${doc.id}`,
                  type: 'contact_message',
                  severity: 'attention',
                  title: 'New contact form message',
                  message: `${name}${email ? ` (${email})` : ''} submitted a contact request that has not been handled yet.`,
                  actionLabel: 'Open support queue',
                  href: `/admin?tab=overview&focus=${encodeURIComponent(doc.id)}`,
                  entityType: 'contact_message',
                  entityId: doc.id,
                  permissionHint: 'enquiries.read',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );

      tasks.push(
        firestore
          .collection('enquiries')
          .where('status', '==', 'new')
          .limit(20)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const name = getString(data, 'name', 'Buyer');
              const listingId = getString(data, 'listingId');
              notifications.push(
                buildNotification({
                  id: `enquiry:${doc.id}`,
                  type: 'enquiry',
                  severity: 'info',
                  title: 'New listing enquiry',
                  message: `${name} submitted a listing enquiry${listingId ? ` for listing ${listingId}` : ''}.`,
                  actionLabel: 'Open listing context',
                  href: listingId
                    ? `/admin?tab=listings&focus=${encodeURIComponent(listingId)}`
                    : '/admin?tab=overview',
                  entityType: 'enquiry',
                  entityId: doc.id,
                  permissionHint: 'enquiries.read',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    if (can(profile, 'users.read')) {
      tasks.push(
        firestore
          .collection('users')
          .where('accountStatus', '==', 'pending')
          .limit(20)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const accountType = getString(data, 'accountType');
              const role = getString(data, 'role');
              if (accountType === 'dealer' || accountType === 'dealer_staff' || role === 'dealer') {
                return;
              }

              const email = getString(data, 'email', doc.id);
              notifications.push(
                buildNotification({
                  id: `user_review:${doc.id}`,
                  type: 'user_review',
                  severity: 'attention',
                  title: 'User account needs review',
                  message: `${email} is still marked pending and may need approval, cleanup, or support follow-up.`,
                  actionLabel: 'Review user',
                  href: `/admin?tab=users&focus=${encodeURIComponent(doc.id)}`,
                  entityType: 'user',
                  entityId: doc.id,
                  permissionHint: 'users.read',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    if (hasAnyPermission(profile, ['stations.read', 'stations.edit'])) {
      tasks.push(
        firestore
          .collection('charging_stations')
          .where('isActive', '==', false)
          .limit(20)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const name = getString(data, 'name', 'Charging station');
              notifications.push(
                buildNotification({
                  id: `station_quality:${doc.id}`,
                  type: 'station_quality',
                  severity: 'info',
                  title: 'Charging station inactive',
                  message: `${name} is inactive and may need verification, coordinates, or cleanup.`,
                  actionLabel: 'Review station',
                  href: `/admin?tab=stations&stationFilter=inactive&focus=${encodeURIComponent(doc.id)}`,
                  entityType: 'charging_station',
                  entityId: doc.id,
                  permissionHint: 'stations.edit',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    if (hasAnyPermission(profile, ['blog.read', 'blog.publish'])) {
      tasks.push(
        firestore
          .collection('blogPosts')
          .where('status', '==', 'draft')
          .limit(20)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const title = getString(data, 'title', 'Draft blog post');
              notifications.push(
                buildNotification({
                  id: `blog_draft:${doc.id}`,
                  type: 'blog_draft',
                  severity: 'info',
                  title: 'Draft blog content waiting',
                  message: `${title} is still draft and may need editorial review or publishing.`,
                  actionLabel: 'Open blog',
                  href: `/admin?tab=blog&blogFilter=draft&focus=${encodeURIComponent(doc.id)}`,
                  entityType: 'blog_post',
                  entityId: doc.id,
                  permissionHint: 'blog.publish',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    if (hasAnyPermission(profile, ['admins.invite', 'admins.assign_permissions', 'dealers.manage_staff'])) {
      tasks.push(
        firestore
          .collection('accessInvites')
          .where('status', '==', 'pending')
          .limit(20)
          .get()
          .then(snapshot => {
            snapshot.docs.forEach(doc => {
              const data = doc.data() as DocumentData;
              const inviteType = getString(data, 'type', 'invite');
              const email = getString(data, 'email', 'Unknown email');
              const isPlatformAdminInvite = inviteType === 'platform_admin';
              if (isPlatformAdminInvite && !hasAnyPermission(profile, ['admins.invite', 'admins.assign_permissions'])) {
                return;
              }
              if (!isPlatformAdminInvite && !can(profile, 'dealers.manage_staff')) {
                return;
              }

              notifications.push(
                buildNotification({
                  id: `access_invite:${doc.id}`,
                  type: 'access_invite',
                  severity: isPlatformAdminInvite ? 'attention' : 'info',
                  title: isPlatformAdminInvite ? 'Pending platform admin invite' : 'Pending dealer staff invite',
                  message: `${email} has not accepted the ${inviteType.replace('_', ' ')} invite yet.`,
                  actionLabel: isPlatformAdminInvite ? 'Open access control' : 'Open dealer operations',
                  href: isPlatformAdminInvite ? '/admin?tab=access' : '/admin?tab=dealers',
                  entityType: 'invite',
                  entityId: doc.id,
                  permissionHint: isPlatformAdminInvite ? 'admins.assign_permissions' : 'dealers.manage_staff',
                  createdAt: getCreatedAt(data),
                }),
              );
            });
          }),
      );
    }

    await Promise.all(tasks);

    const sorted = sortNotifications(notifications).slice(0, MAX_NOTIFICATIONS);

    return json(200, {
      ok: true,
      notifications: sorted,
      unreadCount: sorted.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side admin notifications are not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so admin notifications are temporarily unavailable.');
    }

    return internalError(message);
  }
};
