import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { hasPermission } from '../../utils/accessControl';
import type { InternalGuideContent, InternalGuideId } from '../../services/internalGuides';
import type { UserProfile } from '../../types';

interface InternalGuideRequestBody {
  guideId?: InternalGuideId;
}

const activeStatuses = new Set(['active', 'approved']);

const isPlatformAdmin = (profile: UserProfile) =>
  profile.role === 'admin' ||
  profile.accountType === 'admin' ||
  profile.isMasterAdmin === true ||
  hasPermission(profile, 'audit.view') ||
  hasPermission(profile, 'reports.read') ||
  hasPermission(profile, 'dealers.read');

const canReadDealerGuide = (profile: UserProfile) =>
  isPlatformAdmin(profile) ||
  (
    profile.role === 'dealer' &&
    (profile.accountType === 'dealer' || profile.accountType === 'dealer_staff') &&
    activeStatuses.has(profile.accountStatus ?? profile.status ?? 'active')
  );

const masterAdminGuide: InternalGuideContent = {
  id: 'master-admin',
  title: 'Master Admin CMS And Control Center Guide',
  eyebrow: 'Private admin-only documentation',
  subtitle:
    'Operate the internal Makina Elektrike dashboard after the access-control, dealer-plan, placement, audit, image-upload, listing-governance, and model-review changes. This content is served only after authenticated admin authorization.',
  quickLinks: [
    { label: 'Open dashboard', to: '/admin', note: 'Return to the main control center.' },
    { label: 'Dealer guide', to: '/admin/dealer-guide', note: 'Review the dealer-facing workflow from the admin side.' },
    { label: 'Safety checklist', to: '#safe-operations', note: 'Jump to high-risk operation checks.' },
  ],
  sections: [
    {
      id: 'start-here',
      title: 'Start Here',
      summary: 'Use this section when opening the control center and deciding what to do first.',
      icon: 'layout',
      steps: [
        {
          title: 'Read the dashboard as an operations cockpit',
          body:
            'The overview shows pending dealer approvals, pending listings, active entities, plan distribution, recent growth, and audit activity. Start here before editing records so you know whether the task is moderation, catalog work, commercial placement, or access control.',
        },
        {
          title: 'Use tabs as work areas',
          body:
            'Dealers, users, listings, models, stations, blog, placements, reports, access, audit, and migration share the same governance model. If a change affects public visibility, ownership, billing, access, or canonical data, expect audit or review metadata to exist.',
        },
        {
          title: 'Prefer control-center details for sensitive work',
          body:
            'List tables are for scanning and bulk movement. Control-center modals are for decisions. Open the detail view when you need relationships, owner account state, notes, history, linked content, review context, or billing context.',
        },
      ],
      links: [
        { label: 'Open admin dashboard', to: '/admin', note: 'Return to the main control center.' },
        { label: 'Open dealer guide', to: '/admin/dealer-guide', note: 'Review dealer workflow rules.' },
      ],
    },
    {
      id: 'access-control',
      title: 'Access Control',
      summary: 'Create platform admins, assign roles, and understand who can touch privileged workflows.',
      icon: 'lock',
      steps: [
        {
          title: 'Use Access for platform administrators',
          body:
            'Search for an existing user by email or UID, then assign admin role IDs or direct permissions. Master admin has full authority. Lower roles should be scoped by job: content, catalog, dealer operations, user support, charging, analyst, or platform operations.',
        },
        {
          title: 'Keep dealer accounts dealer-scoped',
          body:
            'Dealer owner and dealer staff accounts should stay dealer-scoped. If someone from a dealership also needs platform admin access, use a separate user account to avoid crossing dealer ownership permissions with platform authority.',
        },
        {
          title: 'Use trusted invite flows',
          body:
            'Admin invites and dealer staff invites run through backend flows. Use them instead of manually editing user documents unless you are doing a controlled recovery operation and understand every affected field.',
        },
        {
          title: 'Check effective permission',
          body:
            'Role labels are shorthand. Actual authority comes from role IDs, direct permissions, account status, and backend enforcement. If something is hidden or disabled, check Access and the user control-center data before assuming a UI bug.',
        },
      ],
    },
    {
      id: 'dealers-users',
      title: 'Dealers And Users',
      summary: 'Approve, correct, suspend, reactivate, and govern dealer and user records.',
      icon: 'users',
      steps: [
        {
          title: 'Dealer approval controls public visibility',
          body:
            'A dealer should be public only when approved, active, and not deleted. Pending dealers can exist in admin but remain hidden from public dealer lists until approved.',
        },
        {
          title: 'Dealer profile fields are operational data',
          body:
            'Admins can force-correct public dealer information including name, address, brand coverage, service capabilities, certification details, images, gallery, linked models, plan tier, and status. Use internal notes when the correction comes from a support or policy decision.',
        },
        {
          title: 'Service capability fields need review discipline',
          body:
            'Dealers can claim EV service, certified service, parts supply, battery diagnostics, charging help, warranty support, trade-in, financing, roadside assistance, or other support. If a claim is not verified, correct it or add an internal note explaining what needs confirmation.',
        },
        {
          title: 'Plans and promotions are separate',
          body:
            'Free or paid dealer status controls baseline entitlements. Sponsorship orders and public campaigns control paid visibility inventory. Do not promise homepage or listing-page visibility just because a dealer is marked paid.',
        },
      ],
    },
    {
      id: 'listings',
      title: 'Listings',
      summary: 'Moderate dealer inventory and review dealer-specific model overrides before publication.',
      icon: 'clipboard',
      steps: [
        {
          title: 'Pending listings need business and data review',
          body:
            'A new dealer listing starts pending. Review title, make, model, price, mileage, images, location, dealer ownership, and commercial flags before approving or activating.',
        },
        {
          title: 'Model-card override reasons matter',
          body:
            'When a dealer creates a listing from a canonical model card and changes make, model, body type, battery, or range, the listing captures a reason. Reasons include submodel or trim, catalog error, market variant, dealer-specific configuration, or other. Other requires notes.',
        },
        {
          title: 'Catalog errors should create model-review work',
          body:
            'If a listing says the canonical model card is wrong, do not silently approve and forget it. Open the model control center, inspect the linked model, and decide whether the canonical EV model needs an admin correction.',
        },
        {
          title: 'Use rejection and notes for audit clarity',
          body:
            'If a listing is rejected or hidden, leave a clear reason. If a dealer needs better photos, a corrected price, or an imported-variant explanation, future admins should be able to understand that history.',
        },
      ],
    },
    {
      id: 'models',
      title: 'EV Models',
      summary: 'Protect canonical EV data while still allowing dealer-originated submissions.',
      icon: 'database',
      steps: [
        {
          title: 'Canonical model cards are platform-owned truth',
          body:
            'Published model cards describe the vehicle model generally. Dealer-specific listings can differ because of trims, import markets, equipment, mileage, or configuration.',
        },
        {
          title: 'Dealer-created models enter review',
          body:
            'When dealers create models from their dashboard, those models are marked pending review and inactive until admin approval. This protects catalog quality while still letting dealers submit missing vehicles.',
        },
        {
          title: 'Review ownership and usage before editing',
          body:
            'Before changing a canonical model, inspect linked dealers, linked listings, owner metadata, review status, recent admin actions, and notes. A model edit can affect many public pages and SEO surfaces.',
        },
      ],
    },
    {
      id: 'placements',
      title: 'Promotions And Monetization',
      summary: 'Control paid visibility without hardcoding promoted dealers, listings, models, or services.',
      icon: 'megaphone',
      steps: [
        {
          title: 'Understand the three-layer placement model',
          body:
            'Placement zones define where something can appear. Sponsorship products define what can be sold. Sponsorship orders represent requests, quotes, reservations, payments, and invoices. Public promotional campaigns are what actually render.',
        },
        {
          title: 'Active order does not automatically mean public ad',
          body:
            'A dealer can have a paid or active sponsorship order without a linked public campaign. If an ad is not appearing, check campaign existence, order linkage, status, zone, entity, and date window.',
        },
        {
          title: 'Use the create-public-campaign bridge',
          body:
            'For eligible paid or reserved sponsorship orders, use the admin action that creates and links a public campaign. Then verify zones, entity type, entity ID, dates, and status.',
        },
        {
          title: 'Never hardcode paid visibility',
          body:
            'Promoted dealers, listings, models, blog items, charging stations, services, and house campaigns should resolve through placement data. This keeps visibility under master-admin control and makes billing evidence easier to audit.',
        },
      ],
    },
    {
      id: 'content-stations',
      title: 'Blog And Charging Stations',
      summary: 'Manage editorial and infrastructure data with review discipline.',
      icon: 'file',
      steps: [
        {
          title: 'Blog content is public content with revision history',
          body:
            'Use blog controls for publishing, unpublishing, localization, SEO metadata, and revisions. Keep titles, meta descriptions, focus keywords, translations, and canonical URLs intentional.',
        },
        {
          title: 'Charging stations need operational freshness',
          body:
            'Charging data can become stale. When editing stations, check address, plug types, operator, charging speed, pricing details, map link, latitude, longitude, and active status.',
        },
        {
          title: 'Use notes for uncertainty',
          body:
            'If a station or content item is not fully verified, add an internal note so future admins know whether the data came from import, manual confirmation, user report, or platform research.',
        },
      ],
    },
    {
      id: 'reports-audit',
      title: 'Reports And Audit',
      summary: 'Use analytics, exports, and history to understand what changed and why.',
      icon: 'shield',
      steps: [
        {
          title: 'Use reports before commercial decisions',
          body:
            'Reports summarize entity counts, dealer plan distribution, placement performance, trend buckets, and operational health. Use them before promotion, cleanup, or moderation prioritization decisions.',
        },
        {
          title: 'Audit is privileged change history',
          body:
            'Admin actions for access, dealers, users, listings, models, stations, blog, and placements should leave audit records. If something changed unexpectedly, search audit before changing more data.',
        },
        {
          title: 'Export only when needed',
          body:
            'Exports can include sensitive operational information. Use them for reconciliation or backup, not casual sharing. Treat exported files as internal platform material.',
        },
      ],
    },
    {
      id: 'safe-operations',
      title: 'Safe Operations',
      summary: 'Use this checklist before risky changes.',
      icon: 'book',
      steps: [
        {
          title: 'Before approving',
          body:
            'Confirm ownership, public quality, required fields, images, and whether the entity should be active now. For dealer and listing approvals, verify that visible contact or sales information is usable.',
        },
        {
          title: 'Before deleting or hiding',
          body:
            'Prefer soft deletion, inactive status, or archived status where available. Make sure the record is not linked to active sponsorship, public campaign, dealer inventory, or SEO-critical content.',
        },
        {
          title: 'Before changing access',
          body:
            'Confirm account identity, email, account type, and whether the person should be a platform admin, dealer owner, or dealer staff member. Wrong access changes are higher risk than content mistakes.',
        },
        {
          title: 'Before troubleshooting ads',
          body:
            'Check placement zone, sponsorship product, sponsorship order, public campaign, campaign status, start date, end date, entity type, entity ID, and whether the public page uses that zone.',
        },
      ],
    },
  ],
};

const dealerGuide: InternalGuideContent = {
  id: 'dealer',
  title: 'Dealer Dashboard Guide',
  eyebrow: 'Private dealership documentation',
  subtitle:
    'Use this guide to manage public profile data, brands, service capabilities, images, represented models, inventory listings, staff access, and paid promotion requests.',
  quickLinks: [
    { label: 'Dealer dashboard', to: '/dealer/dashboard', note: 'Open the main dealership workspace.' },
    { label: 'Manage listings', to: '/dealer/listings', note: 'Open inventory management.' },
    { label: 'Create listing', to: '/dealer/listings?new=1', note: 'Start a new listing submission.' },
  ],
  sections: [
    {
      id: 'dashboard-basics',
      title: 'Dashboard Basics',
      summary: 'The dealer dashboard manages the business profile, models, team, promotions, and listings.',
      icon: 'store',
      steps: [
        {
          title: 'Start on the dashboard overview',
          body:
            'The top cards summarize listings, represented models, and profile completion. Use them to see whether your profile needs information, listings are pending review, or model coverage is incomplete.',
        },
        {
          title: 'Know who can use this guide',
          body:
            'Dealer owners, managers, and editors can use this guide. Some actions, such as inviting team members or requesting paid promotion, may be limited to owner or manager access.',
        },
        {
          title: 'Public changes and reviewed changes differ',
          body:
            'Profile contact information can update your dealer page. New listings, dealer-created model cards, and promotion requests still require platform review before becoming public or promoted.',
        },
      ],
    },
    {
      id: 'profile',
      title: 'Dealer Profile',
      summary: 'Keep public dealership information accurate, complete, and useful for buyers.',
      icon: 'clipboard',
      steps: [
        {
          title: 'Complete identity and contact fields',
          body:
            'Add dealership name, primary contact, phone, email, website, city, and street address. Missing location or contact data makes the public dealer page less useful and can delay review.',
        },
        {
          title: 'Define brands and vehicle focus',
          body:
            'Use Brands you carry for manufacturer names. Use Vehicle focus for positioning such as new EVs, used EVs, certified pre-owned, imports, commercial vans, or premium vehicles.',
        },
        {
          title: 'Describe service capabilities honestly',
          body:
            'Select only services your dealership can actually provide: EV service, certified service, parts supply, battery diagnostics, charging help, warranty support, trade-in, financing, roadside assistance, or other support.',
        },
        {
          title: 'Use certification and service notes',
          body:
            'If you select official or certified service, explain the certification, brand relationship, technician training, warranty process, or limitations. Mention partner workshops clearly.',
        },
      ],
    },
    {
      id: 'images',
      title: 'Images And Gallery',
      summary: 'Use compressed, relevant images so the profile looks professional without wasting storage.',
      icon: 'camera',
      steps: [
        {
          title: 'Upload one strong hero image',
          body:
            'Use a clear showroom, storefront, branded exterior, or high-quality dealership photo. Avoid screenshots, blurry images, or unrelated stock photos.',
        },
        {
          title: 'Use gallery images for trust',
          body:
            'Gallery images can show showroom, service area, vehicle stock, staff, delivery area, or brand presentation. If a photo no longer represents the dealership, remove it.',
        },
        {
          title: 'If upload fails',
          body:
            'Try a smaller JPEG or PNG and avoid unusually large files. Wait for the upload to finish before saving again.',
        },
      ],
    },
    {
      id: 'models',
      title: 'Models You Represent',
      summary: 'Link existing canonical model cards or submit missing models for platform review.',
      icon: 'car',
      steps: [
        {
          title: 'Attach existing models first',
          body:
            'Search the existing model list before creating a new one. Attaching an existing model is faster and keeps your public profile aligned with the platform catalog.',
        },
        {
          title: 'Create a new model only when missing',
          body:
            'If the EV model you sell is not available, create a new model from the dashboard. Dealer-created models enter platform review before they become canonical public catalog data.',
        },
        {
          title: 'Add useful review notes',
          body:
            'Use notes for market version, trim, battery size, charging speed, import source, or the source of specifications.',
        },
      ],
    },
    {
      id: 'listings',
      title: 'Listings',
      summary: 'Create inventory listings from scratch or from existing model cards.',
      icon: 'book',
      steps: [
        {
          title: 'Use model cards when possible',
          body:
            'Choose a model profile if the vehicle matches an existing EV model. The form copies key model data such as brand, model name, body type, battery, range, and images where available.',
        },
        {
          title: 'Create from scratch when no model fits',
          body:
            'Leave model profile empty and fill listing fields manually for unusual imports, one-off vehicles, or models not yet in the platform catalog.',
        },
        {
          title: 'Explain changed model-card data',
          body:
            'If you choose a model card and then change make, model, body type, battery, or range, choose why: submodel or trim, catalog error, market variant, dealer-specific configuration, or other. Other requires notes.',
        },
        {
          title: 'Listings describe exact vehicles',
          body:
            'A listing should describe the exact vehicle being sold: year, mileage, price, location, availability, images, financing, rental, or subscription flags. It does not rewrite the canonical model card.',
        },
      ],
    },
    {
      id: 'team-access',
      title: 'Team Access',
      summary: 'Invite dealership staff and control who can help manage operations.',
      icon: 'users',
      steps: [
        {
          title: 'Use invites instead of shared passwords',
          body:
            'Dealer owners and managers should invite team members with their own email addresses. Do not share the owner account password with staff.',
        },
        {
          title: 'Pick the smallest useful role',
          body:
            'Managers can help administer the workspace. Editors should be used for operational editing. Remove team members when they leave.',
        },
        {
          title: 'Plan limits can affect staff count',
          body:
            'Free and paid dealer plans may allow different numbers of staff accounts. If an invite cannot be created, check plan capacity.',
        },
      ],
    },
    {
      id: 'promotions',
      title: 'Promotion Requests',
      summary: 'Request sponsored visibility while admin approval controls public placement.',
      icon: 'megaphone',
      steps: [
        {
          title: 'Promotion requests are not instant ads',
          body:
            'Submitting a request creates an order/request record. The platform must quote, reserve, mark payment, and create or link a public campaign before it appears publicly.',
        },
        {
          title: 'Choose zones that match the goal',
          body:
            'Dealer spotlights help dealership visibility. Listing placements help sell inventory. Model placements associate a dealer with a specific EV model or category.',
        },
        {
          title: 'Check request and payment status',
          body:
            'Order status and payment status describe the commercial workflow. Public visibility still depends on the linked campaign state, zones, and dates.',
        },
      ],
    },
    {
      id: 'admin-review',
      title: 'Admin Review And Corrections',
      summary: 'Understand what platform admins can review, approve, edit, or override.',
      icon: 'shield',
      steps: [
        {
          title: 'Admins can correct dealer information',
          body:
            'Platform admins can edit dealer profile data, service capabilities, linked models, images, plan tier, status, and internal notes when data quality, policy, billing, or support requires it.',
        },
        {
          title: 'Canonical data is reviewed separately',
          body:
            'Dealer-created model cards and listing-based catalog corrections are reviewed separately from public dealer profile edits. This protects the platform catalog from accidental or promotional changes.',
        },
        {
          title: 'Use notes for faster approval',
          body:
            'When a listing differs from a model card, or when a dealership claims certified service, notes help admins approve faster and avoid clarification loops.',
        },
      ],
    },
  ],
};

const getGuide = (guideId: InternalGuideId) => {
  if (guideId === 'master-admin') return masterAdminGuide;
  if (guideId === 'dealer') return dealerGuide;
  return null;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = event.body ? (JSON.parse(event.body) as InternalGuideRequestBody) : {};
    const guideId = body.guideId;
    const guide = guideId ? getGuide(guideId) : null;

    if (!guide || !guideId) {
      return badRequest('A valid guideId is required.');
    }

    if (guideId === 'master-admin' && !isPlatformAdmin(profile)) {
      return forbidden('You do not have access to the admin guide.');
    }

    if (guideId === 'dealer' && !canReadDealerGuide(profile)) {
      return forbidden('You do not have access to the dealer guide.');
    }

    return json(200, { ok: true, guide });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Internal guides are not configured.');
    }
    if (message.includes('guideId') || message.includes('JSON')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
