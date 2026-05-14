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
  title: 'Master Admin CMS And Control Center Operating Manual',
  eyebrow: 'Private admin-only documentation',
  subtitle:
    'A step-by-step operating manual for the Makina Elektrike control center: approvals, users, dealers, listings, EV models, stations, blog, monetization, access, audit, reports, notifications, and safe recovery workflows. This content is served only after authenticated admin authorization.',
  quickLinks: [
    { label: 'Open dashboard', to: '/admin', note: 'Return to the main control center.' },
    { label: 'Action center', to: '#notifications', note: 'Review all pending work queues.' },
    { label: 'Dealer manual', to: '/admin/dealer-guide', note: 'Open the dealer-facing workflow guide from admin view.' },
  ],
  sections: [
    {
      id: 'daily-triage',
      title: 'Daily Triage Workflow',
      summary:
        'Use this when you first open the dashboard. The goal is to identify what needs action, what needs review, and what is only informational.',
      icon: 'layout',
      steps: [
        {
          title: 'Open the overview first',
          body:
            'Start from the Overview tab before editing records. It summarizes pending dealer approvals, listing moderation, paid-dealer status, content backlog, charging-station quality, offline queue items, and recent audit activity.',
          bullets: [
            'Pending dealer approvals mean business profiles are waiting for public or operational approval.',
            'Pending listings mean dealer inventory is waiting for moderation before public visibility.',
            'Draft blog posts and inactive stations are quality queues, not necessarily emergencies.',
            'Recent audit activity shows privileged actions already taken by admins.',
          ],
          links: [
            { label: 'Open overview', to: '/admin?tab=overview', note: 'Start the control-center triage.' },
          ],
        },
        {
          title: 'Open notifications before searching manually',
          body:
            'Use the Admin notifications button in the sidebar or mobile header. It aggregates current unresolved work across approvals, reviews, promotion orders, contact messages, enquiries, draft content, inactive stations, pending users, and invites.',
          bullets: [
            'Each notification includes severity, summary, entity type, and an action button.',
            'Notification visibility is permission-aware, so limited admins only see what their role can handle.',
            'Use the action button on the notification instead of manually searching first.',
          ],
          result:
            'A good daily routine is Overview, Notifications, Dealers/Listings, Placements, then Audit if anything looks unexpected.',
          links: [
            { label: 'Notification guide', to: '#notifications', note: 'Detailed action-center procedure.' },
          ],
        },
        {
          title: 'Decide whether the task is moderation, operations, commercial, or governance',
          body:
            'Different work belongs in different tabs. Moderation is usually Dealers, Listings, Models, Blog, or Stations. Operations is Users, Dealers, Team, Notes, and Status. Commercial work is Placements. Governance is Access, Audit, Reports, and Migration.',
          bullets: [
            'If a public entity changes visibility, expect an audit or status record.',
            'If a dealer asks for promoted visibility, use Placements, not a static page edit.',
            'If someone needs platform authority, use Access, not dealer staff invites.',
            'If a dealer claims canonical model data is wrong, review the model record before changing the listing alone.',
          ],
        },
      ],
      checklist: [
        'Overview reviewed',
        'Notifications reviewed',
        'High-severity approval queues opened',
        'Commercial placement requests checked',
        'Audit checked if anything looks unexpected',
      ],
      links: [
        { label: 'Open dealers pending approval', to: '/admin?tab=dealers&dealerFilter=pending', note: 'Dealer approvals and rejections.' },
        { label: 'Open listings', to: '/admin?tab=listings', note: 'Dealer inventory moderation.' },
        { label: 'Open placements', to: '/admin?tab=placements', note: 'Promotion, sponsorship, and billing workflow.' },
        { label: 'Open audit', to: '/admin?tab=audit', note: 'Privileged action history.' },
      ],
    },
    {
      id: 'notifications',
      title: 'Notifications And Action Center',
      summary:
        'The notification drawer is the central inbox for work that needs admin review, approval, verification, acceptance, billing, or follow-up.',
      icon: 'bell',
      steps: [
        {
          title: 'Open the admin notification drawer',
          body:
            'Click Admin notifications in the desktop sidebar or the bell icon in the mobile header. The drawer loads from a protected backend endpoint with your Firebase ID token.',
          bullets: [
            'Dealer approval notifications link to the Dealers tab with pending filter.',
            'Listing review notifications link to the Listings tab.',
            'Model review notifications link to the Models tab.',
            'Promotion request notifications link to the Placements tab.',
            'Contact messages and enquiries link to the closest available admin workflow.',
            'Pending invites link to Access or Dealer operations depending on invite type.',
          ],
          links: [
            { label: 'Open overview', to: '/admin?tab=overview', note: 'The notification button is available from the dashboard shell.' },
          ],
        },
        {
          title: 'Use Refresh when you expect new work',
          body:
            'The drawer refreshes automatically while the dashboard is open, but you can click Refresh after a dealer says they submitted a request or after you changed a record and want to confirm queue state.',
          bullets: [
            'Refresh does not approve or dismiss anything.',
            'A notification disappears only when the underlying item is no longer pending or attention-worthy.',
            'For example, a pending listing disappears after it is approved, rejected, hidden, or otherwise resolved.',
          ],
        },
        {
          title: 'Enable browser alerts only if useful',
          body:
            'Click Enable browser alerts in the notification drawer. The browser will ask permission. If allowed, new notifications can appear while the dashboard is open and visible enough for the browser to deliver alerts.',
          warning:
            'Browser alerts are not true background push. If the browser is closed, the computer sleeps, or permissions are blocked, they will not replace an email or push-notification system.',
        },
        {
          title: 'Know what notifications are not',
          body:
            'Notifications are a live work queue. They are not a permanent audit record and they are not a task assignment system yet.',
          bullets: [
            'Use Audit to investigate actions already taken.',
            'Use internal notes to document why a decision was made.',
            'Future upgrades should add read/dismiss state, assignment, SLA timers, email digests, and true push escalation.',
          ],
          links: [
            { label: 'Open audit', to: '/admin?tab=audit', note: 'Review privileged changes after the fact.' },
            { label: 'Open reports', to: '/admin?tab=reports', note: 'Review trends and platform health.' },
          ],
        },
      ],
    },
    {
      id: 'access-control',
      title: 'Access Control And Admin Accounts',
      summary:
        'Use Access Control to create platform admins, assign presets, grant or deny direct permissions, revoke access, and manage platform-admin invites.',
      icon: 'lock',
      steps: [
        {
          title: 'Search the target account',
          body:
            'Open Access Control, enter the user email or UID, and load the account. Confirm the person is a normal user account intended for platform administration.',
          bullets: [
            'Do not promote dealer owner or dealer staff accounts into platform admin access unless you intentionally want to mix those responsibilities.',
            'If a dealership employee needs platform-admin authority, create or use a separate user account.',
            'Confirm email, UID, account type, current status, and existing admin roles before changing anything.',
          ],
          links: [
            { label: 'Open access control', to: '/admin?tab=access', note: 'Manage admin roles and invites.' },
          ],
        },
        {
          title: 'Assign role presets first',
          body:
            'Use admin role presets for the normal cases. Master Admin has full authority. Platform Ops is broad operations. Dealer Ops handles dealers, plans, listings, and enquiries. User Support handles users. Catalog Admin handles EV models. Charging Admin handles stations. Content Admin handles blog/content. Analyst is read-oriented.',
          bullets: [
            'Use the least powerful preset that lets the admin do their job.',
            'Avoid Master Admin unless the person must manage access, settings, monetization, and all entity types.',
            'Role presets are easier to reason about than many one-off direct permissions.',
          ],
        },
        {
          title: 'Use direct permissions only for exceptions',
          body:
            'Direct permissions allow or deny specific capabilities on top of presets. Use them when a person needs a narrow extra capability or when one capability must be removed from a broad preset.',
          bullets: [
            'Examples: allow blog.publish to a content helper, allow placements.analytics_read to an analyst, or deny admin access management for a broad operations user.',
            'After changing direct permissions, review the effective permission preview.',
            'Keep notes outside the user-facing profile if the decision is sensitive.',
          ],
        },
        {
          title: 'Create, copy, and revoke platform-admin invites',
          body:
            'Use the invite section to create secure platform-admin invite links. The invited person signs in with the target email and accepts through the trusted backend flow.',
          bullets: [
            'Select at least one admin preset before creating an invite.',
            'Copy the invite link only to the intended person.',
            'Revoke pending invites that were sent to the wrong address or are no longer needed.',
          ],
          warning:
            'Access changes are among the highest-risk admin actions. Confirm identity before saving.',
        },
      ],
      checklist: [
        'Target account identity confirmed',
        'Dealer accounts kept dealer-scoped unless intentional',
        'Preset roles used before direct permissions',
        'Effective permissions reviewed',
        'Unneeded pending invites revoked',
      ],
      links: [
        { label: 'Open access control', to: '/admin?tab=access', note: 'Assign admin roles and permissions.' },
        { label: 'Open users', to: '/admin?tab=users', note: 'Inspect user account state before assigning admin access.' },
      ],
    },
    {
      id: 'users',
      title: 'Users And Account Support',
      summary:
        'Use Users to inspect normal user accounts, support account-status issues, suspend/reactivate accounts, and understand dealer relationships.',
      icon: 'users',
      steps: [
        {
          title: 'Look up by email or UID',
          body:
            'Open Users, enter the email or UID, and load the account. The result shows identity, role/account type, account status, auth status, dealer links, listing counts where relevant, notes, and recent audit logs.',
          bullets: [
            'Use email lookup when responding to support requests.',
            'Use UID lookup when investigating an audit log or Firebase record.',
            'If the account is linked to dealer operations, manage dealer status through Dealers rather than forcing user-only changes.',
          ],
          links: [
            { label: 'Open users', to: '/admin?tab=users', note: 'Search and inspect user accounts.' },
          ],
        },
        {
          title: 'Suspend or reactivate carefully',
          body:
            'Use Suspend for abuse, policy violations, spam, or safety issues. Use Reactivate only after the issue is resolved and the account should regain access.',
          bullets: [
            'Suspension is operationally safer than deleting user data.',
            'Do not use user status controls for pending dealer accounts; use dealer workflows instead.',
            'After changing status, check audit and add an internal note if context matters.',
          ],
          warning:
            'Account status changes affect access. Confirm you have the right user before clicking status actions.',
        },
        {
          title: 'Record support context with notes',
          body:
            'Use internal notes to document why a user was suspended, reactivated, investigated, or corrected. Notes help future admins avoid repeating the same investigation.',
          bullets: [
            'Include support ticket context if available.',
            'Avoid unnecessary personal data.',
            'Make notes factual: what happened, what you checked, and what decision was taken.',
          ],
        },
      ],
      links: [
        { label: 'Open users', to: '/admin?tab=users', note: 'User lookup and status controls.' },
        { label: 'Open audit', to: '/admin?tab=audit', note: 'Review user-related privileged changes.' },
      ],
    },
    {
      id: 'dealers',
      title: 'Dealers Control Center',
      summary:
        'Use Dealers for business-profile approval, public profile corrections, plan assignment, owner reassignment, dealer-team management, activation, internal notes, and audit history.',
      icon: 'store',
      steps: [
        {
          title: 'Choose the right dealer filter',
          body:
            'The Dealers tab supports Active, Inactive, Pending, and Deleted views. Start with Pending for new onboarding, Active for public business records, Inactive for paused or hidden records, and Deleted for archived cleanup.',
          bullets: [
            'Use search to find a dealer by name or email.',
            'Use Select All only when you are certain every visible dealer should receive the same bulk action.',
            'Bulk approve, deactivate, reactivate, or delete should be used sparingly.',
          ],
          links: [
            { label: 'Pending dealers', to: '/admin?tab=dealers&dealerFilter=pending', note: 'Review new dealer registrations.' },
            { label: 'Active dealers', to: '/admin?tab=dealers&dealerFilter=active', note: 'Review currently active dealers.' },
          ],
        },
        {
          title: 'Approve or reject onboarding',
          body:
            'Open a pending dealer, inspect business name, contact details, location, website, brands, services, images, linked owner account, and any obvious quality or policy concerns. Approve only when the profile is suitable for platform use.',
          bullets: [
            'Approve when the dealer is legitimate and profile data is usable.',
            'Reject when the profile is spam, incomplete beyond recovery, or clearly not valid.',
            'Use internal notes when rejecting or when approval depends on later verification.',
          ],
          warning:
            'Approving a dealer can make the dealer operational and may affect public visibility depending on status flags.',
        },
        {
          title: 'Edit dealer profile data',
          body:
            'Use Edit Dealer to correct public information. Admins can edit core identity, contact details, city, address, description, social links, brands, languages, vehicle focus, price range, notes, service capabilities, certification details, and service notes.',
          bullets: [
            'Service capabilities include EV service, certified service, parts supply, battery diagnostics, charging installation, warranty support, trade-in, financing, roadside assistance, and other.',
            'Certification details should explain official service claims or partner-workshop limitations.',
            'Use public-facing fields for buyer-relevant information and internal notes for admin-only context.',
          ],
          links: [
            { label: 'Dealer public guide', to: '/admin/dealer-guide#profile', note: 'Review what dealers are told to maintain.' },
          ],
        },
        {
          title: 'Assign plans and commercial entitlements',
          body:
            'Use plan controls to assign Free or Paid dealer status and subscription state. Plan status controls entitlements such as listing capacity, team capacity, rich media, analytics, support priority, and promotion eligibility. It does not itself create sponsored visibility.',
          bullets: [
            'Free is the baseline dealer participation tier.',
            'Paid enables stronger dealer capabilities and eligibility for sponsorship products.',
            'Promotion visibility is still controlled through Sponsorship Orders and Promotional Campaigns in Placements.',
          ],
          links: [
            { label: 'Open placements', to: '/admin?tab=placements', note: 'Control paid placement visibility.' },
          ],
        },
        {
          title: 'Use the dealer detail control center for sensitive work',
          body:
            'Open the dealer control-center detail when you need owner account state, linked listings, model count, enquiries, staff members, pending invites, team capacity, internal notes, and recent audit records.',
          bullets: [
            'Reassign owner only after confirming the new owner email or UID.',
            'Remove staff only when access should end.',
            'Revoke pending invites if they were sent to the wrong person or are stale.',
            'Use notes for verification, policy, billing, or support history.',
          ],
        },
        {
          title: 'Activate dealer owner accounts only when needed',
          body:
            'Some dealer records may need account activation. Use the activation modal only when the dealer should receive login access and you have the correct email and temporary password process.',
          warning:
            'Do not create credentials for the wrong email. If in doubt, verify the dealer owner first.',
        },
      ],
      checklist: [
        'Business identity checked',
        'Owner account checked',
        'Public contact data checked',
        'Service claims checked',
        'Plan and subscription state intentional',
        'Notes added for unclear decisions',
      ],
      links: [
        { label: 'Open dealers', to: '/admin?tab=dealers', note: 'Dealer management table.' },
        { label: 'Pending dealers', to: '/admin?tab=dealers&dealerFilter=pending', note: 'Dealer onboarding queue.' },
        { label: 'Dealer manual', to: '/admin/dealer-guide', note: 'What dealers see and can do.' },
      ],
    },
    {
      id: 'listings',
      title: 'Listings Moderation',
      summary:
        'Use Listings to review dealer inventory, approve or reject public visibility, inspect linked dealer/model context, and resolve model-card overrides.',
      icon: 'clipboard',
      steps: [
        {
          title: 'Review pending listings first',
          body:
            'A dealer-created listing starts pending. Inspect title, make, model, year, mileage, price, location, images, gallery, dealer ownership, and public description before approval.',
          bullets: [
            'Approve only when the listing is specific, credible, and suitable for public marketplace display.',
            'Reject if it is spam, misleading, duplicated, not an EV/allowed vehicle, or not ready.',
            'Hide or deactivate if it should temporarily disappear without full deletion.',
          ],
          links: [
            { label: 'Open listings', to: '/admin?tab=listings', note: 'Moderate dealer inventory.' },
          ],
        },
        {
          title: 'Check model-card override metadata',
          body:
            'When a dealer chooses an existing model card and changes copied technical fields, the listing stores changed fields, the original model snapshot, reason, and notes. Treat this as a governance signal.',
          bullets: [
            'Submodel or trim means the listing may be correct for a specific variant.',
            'Catalog error means the canonical EV model may need correction.',
            'Market variant means the imported vehicle may legitimately differ by region.',
            'Dealer-specific configuration means equipment differs for this exact unit.',
            'Other requires notes and should be reviewed carefully.',
          ],
          warning:
            'If the dealer claims a catalog error, review the linked EV model before approving the listing and forgetting the issue.',
          links: [
            { label: 'Open model review', to: '/admin?tab=models', note: 'Review canonical model data.' },
          ],
        },
        {
          title: 'Use the listing detail control center',
          body:
            'Open listing detail when you need ownership, dealer linkage, enquiries, model override details, notes, and audit history. This is where you can understand why the listing exists and what it affects.',
          bullets: [
            'Check linked dealer status before approving.',
            'Check enquiry count if you are hiding an active listing.',
            'Add notes when approval depends on a condition or correction.',
          ],
        },
        {
          title: 'Handle bulk listing actions conservatively',
          body:
            'Bulk approve, reject, hide, and delete save time but can create visible marketplace changes fast. Use them only after filtering and searching precisely.',
          warning:
            'Never bulk approve listings only because they came from a paid dealer. Paid status does not bypass moderation.',
        },
      ],
      links: [
        { label: 'Open listings', to: '/admin?tab=listings', note: 'Listing moderation workflow.' },
        { label: 'Dealer listing manual', to: '/admin/dealer-guide#listings', note: 'How dealers create listings.' },
      ],
    },
    {
      id: 'models',
      title: 'EV Model Catalog Governance',
      summary:
        'Use Models to maintain canonical EV information, media, visibility, featured status, dealer-created submissions, and model-review decisions.',
      icon: 'car',
      steps: [
        {
          title: 'Understand canonical versus listing-specific data',
          body:
            'A model card is platform-governed reference data. A listing describes a specific vehicle. Listings can differ because of trim, market version, equipment, or dealer-specific configuration.',
          bullets: [
            'Do not change canonical model data just to match one unusual listing.',
            'Do update canonical data when the existing model card is objectively wrong or incomplete.',
            'Use model notes and review notes to preserve context.',
          ],
        },
        {
          title: 'Filter and search model records',
          body:
            'Use All, Featured, Visible, and Hidden filters plus search by brand/model. Missing images and incomplete specs should be handled as quality work, not only SEO work.',
          bullets: [
            'Visible models can appear publicly.',
            'Featured models receive special emphasis where the frontend supports it.',
            'Hidden models can remain in the database without public exposure.',
          ],
          links: [
            { label: 'Open models', to: '/admin?tab=models', note: 'Catalog management.' },
          ],
        },
        {
          title: 'Review dealer-created model submissions',
          body:
            'Dealer-created models are pending review and inactive until approval. Inspect brand, model name, body type, battery, range, power, seats, charge port, notes, image, gallery, owner dealer, and linked listings.',
          bullets: [
            'Approve when the model is legitimate, sufficiently complete, and not a duplicate.',
            'Reject when it is a duplicate, inaccurate, spam, or too incomplete.',
            'If it duplicates an existing model, prefer correcting/merging strategy rather than publishing another copy.',
          ],
          links: [
            { label: 'Dealer model manual', to: '/admin/dealer-guide#models', note: 'How dealers submit represented models.' },
          ],
        },
        {
          title: 'Use images intentionally',
          body:
            'Hero image and gallery media affect model detail pages, cards, and visual quality. Use R2-backed upload paths from the form where available and avoid huge files.',
          bullets: [
            'Primary image should represent the model clearly.',
            'Gallery images should support buyer research, not clutter the page.',
            'If media is wrong, replace it rather than hiding the whole model unless public quality requires it.',
          ],
        },
      ],
      links: [
        { label: 'Open models', to: '/admin?tab=models', note: 'EV catalog control.' },
        { label: 'Open listings', to: '/admin?tab=listings', note: 'Investigate listing-driven model overrides.' },
      ],
    },
    {
      id: 'stations',
      title: 'Charging Stations',
      summary:
        'Use Stations to manage public charging infrastructure data, visibility, coordinates, operator details, and quality notes.',
      icon: 'map',
      steps: [
        {
          title: 'Search and filter station records',
          body:
            'Use All, Active, and Inactive filters. Search by address or operator. Inactive stations are not necessarily deleted; they may need verification, coordinates, pricing, or operator cleanup.',
          bullets: [
            'Active stations can appear on public charging pages.',
            'Inactive stations stay available for review and future correction.',
            'Missing latitude or longitude reduces map usefulness.',
          ],
          links: [
            { label: 'Open stations', to: '/admin?tab=stations', note: 'Charging-station controls.' },
            { label: 'Inactive stations', to: '/admin?tab=stations&stationFilter=inactive', note: 'Stations needing verification.' },
          ],
        },
        {
          title: 'Add or edit station details',
          body:
            'Use Add Station or Edit Station to maintain address, operator, plug types, charging speed, pricing, Google Maps link, latitude, longitude, and active status.',
          bullets: [
            'Coordinates should match the map link and real address.',
            'Plug types and charging speed should be practical for EV drivers.',
            'Pricing details should be clear when known; use notes when uncertain.',
          ],
        },
        {
          title: 'Use station control-center notes',
          body:
            'Open station detail for creator/updater information, recent audit logs, and internal notes. Add a note when data came from import, manual research, user report, or an unverified source.',
          bullets: [
            'Use notes before hiding a station if the reason is not obvious.',
            'Use notes for duplicate risk, stale operator information, or coordinate uncertainty.',
          ],
        },
      ],
      checklist: [
        'Address checked',
        'Coordinates checked',
        'Plug type checked',
        'Operator checked',
        'Active status intentional',
        'Internal note added for uncertainty',
      ],
      links: [
        { label: 'Open stations', to: '/admin?tab=stations', note: 'Manage charging station records.' },
      ],
    },
    {
      id: 'blog',
      title: 'Blog And Editorial CMS',
      summary:
        'Use Blog for editorial publishing, drafts, SEO fields, translations, text imports, media, revisions, and public article quality.',
      icon: 'file',
      steps: [
        {
          title: 'Use draft and published states deliberately',
          body:
            'Draft posts are internal work-in-progress. Published posts can appear publicly and in generated SEO output. Use status filters to separate editorial work from live content.',
          bullets: [
            'Draft means not ready for public reading.',
            'Published means the article should have final title, excerpt, body, image, metadata, and translations where applicable.',
            'Bulk publish should only happen after reviewing all selected posts.',
          ],
          links: [
            { label: 'Open blog', to: '/admin?tab=blog', note: 'Editorial controls.' },
            { label: 'Draft posts', to: '/admin?tab=blog&blogFilter=draft', note: 'Editorial backlog.' },
          ],
        },
        {
          title: 'Create or edit a post',
          body:
            'Use Add Post or Edit to manage title, slug, excerpt, body content, author, date, image, metadata, keywords, status, and localized content depending on the form fields available.',
          bullets: [
            'Keep slugs stable after publishing unless you intentionally handle redirects/SEO implications.',
            'Meta descriptions should be specific and useful, not duplicated across articles.',
            'Use focused keywords naturally and avoid keyword stuffing.',
          ],
        },
        {
          title: 'Use imports carefully',
          body:
            'Bulk import and text import can save time, but imported content still needs editorial review. Check formatting, titles, images, language, metadata, and duplicate topics before publishing.',
          bullets: [
            'After import, keep posts in draft until reviewed.',
            'Use revisions and audit history to understand major changes.',
          ],
        },
      ],
      links: [
        { label: 'Open blog', to: '/admin?tab=blog', note: 'Blog CMS.' },
        { label: 'Open reports', to: '/admin?tab=reports', note: 'Find missing metadata signals.' },
      ],
    },
    {
      id: 'placements',
      title: 'Promotions, Sponsorships, Billing, And Paid Visibility',
      summary:
        'Use Placements to monetize the platform without hardcoding promoted dealers, listings, EV models, blog posts, charging stations, services, or house campaigns.',
      icon: 'megaphone',
      steps: [
        {
          title: 'Know the placement objects',
          body:
            'Placement Zones are where ads can appear. Sponsorship Products define what can be sold. Sponsorship Orders represent dealer requests, quotes, reservations, payments, and invoices. Promotional Campaigns are what the public pages resolve and render.',
          bullets: [
            'A paid dealer plan creates eligibility, not guaranteed visibility.',
            'A sponsorship order is a commercial workflow object.',
            'A public campaign is the visibility object.',
            'A zone controls where and how many campaigns can appear.',
          ],
          links: [
            { label: 'Open placements', to: '/admin?tab=placements', note: 'Commercial control center.' },
          ],
        },
        {
          title: 'Bootstrap placement catalog when needed',
          body:
            'Use Bootstrap defaults only when the placement catalog is missing or needs seeded baseline zones/products. After bootstrap, review zones and products before selling placements.',
          warning:
            'Do not repeatedly bootstrap without checking whether it changed existing placement configuration.',
        },
        {
          title: 'Manage zones',
          body:
            'Zones define page key, slot key, allowed entity types, house/sponsored eligibility, assignment limits, locale targeting, and status. Disable or archive a zone if it should not render.',
          bullets: [
            'Examples include home dealer spotlight, dealers index spotlight, listings index spotlight, models index slot, blog slot, and charging-page promotional slot.',
            'Allowed entity types should match the page context.',
            'Max assignments controls how many campaigns can occupy a zone.',
          ],
        },
        {
          title: 'Manage sponsorship products',
          body:
            'Products define commercial packages: eligible dealer plans, eligible entity types, default duration, price label, description, and status.',
          bullets: [
            'Use products to standardize what you sell.',
            'Keep inactive or archived products from being selected for new dealer requests.',
            'Price labels help internal quoting but should not replace invoice records.',
          ],
        },
        {
          title: 'Handle dealer sponsorship orders',
          body:
            'Orders start as dealer requests or admin-created orders. Review requested zones, preferred dates, entity type, entity ID, notes, dealer plan, price amount, currency, price label, invoice reference, order status, and payment status.',
          bullets: [
            'Draft means request or incomplete order.',
            'Quoted means the dealer has been given commercial terms.',
            'Reserved means inventory is held for the date range.',
            'Paid or active means commercial status is satisfied, but public rendering still needs campaign status and linkage.',
            'Cancelled or expired means no active commercial delivery should continue.',
          ],
        },
        {
          title: 'Create or link the public campaign',
          body:
            'After order details are valid, create or link a Promotional Campaign. Confirm promotion type, sponsored entity type, sponsored entity ID, zones, campaign status, start date, end date, priority, and fallback behavior.',
          bullets: [
            'Use sponsored_promotion for paid visibility.',
            'Use house_promotion for internal platform merchandising.',
            'Campaign status must be scheduled or active and date-valid to render publicly.',
            'If an ad is not visible, check order, campaign, zone, entity, status, and dates.',
          ],
          warning:
            'Never hardcode paid placements directly into public pages. Use the placement-resolution layer so master admin remains in control.',
        },
        {
          title: 'Review placement analytics',
          body:
            'Use analytics for impressions, clicks, campaign performance, zone activity, date ranges, and exportable commercial reporting.',
          bullets: [
            'Low impressions can mean no public traffic, inactive zone, wrong date range, or unresolved campaign.',
            'Clicks without conversions may mean the creative/entity is not compelling.',
            'Export analytics only for internal reporting or reconciliation.',
          ],
          links: [
            { label: 'Open reports', to: '/admin?tab=reports', note: 'Operational exports and trends.' },
          ],
        },
      ],
      checklist: [
        'Dealer plan eligibility checked',
        'Zone compatibility checked',
        'Order status checked',
        'Payment status checked',
        'Campaign linked',
        'Campaign dates valid',
        'Public page zone exists',
        'Analytics reviewed after launch',
      ],
      links: [
        { label: 'Open placements', to: '/admin?tab=placements', note: 'Zones, products, orders, campaigns, analytics.' },
        { label: 'Dealer promotion manual', to: '/admin/dealer-guide#promotions', note: 'How dealers request promotions.' },
      ],
    },
    {
      id: 'reports-audit-migration',
      title: 'Reports, Audit, Offline Queue, And Migration',
      summary:
        'Use these tools for visibility, accountability, recovery, and controlled data changes. They are support systems for admin decisions.',
      icon: 'analytics',
      steps: [
        {
          title: 'Use Reports for platform health',
          body:
            'Reports summarize operational trends, quality gaps, dealer distribution, listing status, blog metadata, station coordinates, placement performance, and exportable operational metrics.',
          bullets: [
            'Use reports before cleanup projects or commercial decisions.',
            'Use export only when you need a working file for reconciliation or analysis.',
            'Treat exported reports as sensitive internal material.',
          ],
          links: [
            { label: 'Open reports', to: '/admin?tab=reports', note: 'Analytics and exports.' },
          ],
        },
        {
          title: 'Use Audit to investigate what changed',
          body:
            'Audit log records trusted backend actions: dealer plans, dealer status, admin access, user status, listings, models, stations, blog posts, placements, invites, and notes where supported.',
          bullets: [
            'Check actor, target, summary, before, after, metadata, and timestamp.',
            'Use audit before reversing or changing more data.',
            'Audit visibility is permission-controlled.',
          ],
          links: [
            { label: 'Open audit', to: '/admin?tab=audit', note: 'Privileged action history.' },
          ],
        },
        {
          title: 'Use Offline Queue for failed local writes',
          body:
            'The Offline queue button shows local operational submissions that were stored because Firebase rejected or could not complete a request. Review them instead of assuming the save succeeded.',
          bullets: [
            'If there are queue items, inspect what failed and decide whether to retry, import manually, or discard.',
            'Do not ignore offline queue counts after a failed save or permission error.',
          ],
        },
        {
          title: 'Use Migration only for controlled maintenance',
          body:
            'Migration tools are for backfills, exports, and cleanup. Use them after reading the purpose of the action and understanding what data class it affects.',
          warning:
            'Migration actions can affect many records. Do not use them as normal editing tools.',
          links: [
            { label: 'Open migration', to: '/admin?tab=migration', note: 'Controlled maintenance tools.' },
          ],
        },
      ],
      links: [
        { label: 'Open reports', to: '/admin?tab=reports', note: 'Operational analytics.' },
        { label: 'Open audit', to: '/admin?tab=audit', note: 'Admin activity history.' },
        { label: 'Open migration', to: '/admin?tab=migration', note: 'Backfill and maintenance tools.' },
      ],
    },
    {
      id: 'safe-operations',
      title: 'Safe Operations And Troubleshooting',
      summary:
        'Use this section before high-risk changes or when something does not look right in production.',
      icon: 'shield',
      steps: [
        {
          title: 'Before approving anything',
          body:
            'Confirm ownership, legitimacy, required fields, public quality, media, and whether the item should be visible now.',
          bullets: [
            'Dealer approval: check business identity and owner.',
            'Listing approval: check exact vehicle details and dealer status.',
            'Model approval: check duplicate risk and canonical quality.',
            'Campaign approval: check payment/order status, dates, zone, and entity.',
          ],
        },
        {
          title: 'Before hiding, deleting, archiving, or suspending',
          body:
            'Prefer reversible states where available. Confirm the record is not linked to active sponsorship, active listings, public campaigns, critical SEO pages, or unresolved support cases.',
          bullets: [
            'Use inactive or archived before permanent removal.',
            'Add notes when the reason is not obvious.',
            'Check audit after high-risk changes.',
          ],
        },
        {
          title: 'If a public ad does not show',
          body:
            'Check all placement dependencies in order: zone exists and active, page renders that zone, sponsorship order is valid, campaign is linked, campaign status is scheduled or active, dates are valid, entity type is allowed, and entity ID exists.',
          links: [
            { label: 'Open placements', to: '/admin?tab=placements', note: 'Troubleshoot promotion delivery.' },
          ],
        },
        {
          title: 'If a dealer says something is missing',
          body:
            'Identify whether the issue is profile data, listing moderation, model review, media upload, staff access, promotion order, or public placement rendering. Then open the relevant tab and check audit/notes.',
          bullets: [
            'Profile issue: Dealers tab.',
            'Listing issue: Listings tab.',
            'Model issue: Models tab.',
            'Image issue: dealer dashboard media or listing/model media flow.',
            'Promotion issue: Placements tab.',
            'Access issue: Dealer control center or Access tab.',
          ],
        },
      ],
      checklist: [
        'Correct entity identified',
        'Ownership confirmed',
        'Status and visibility checked',
        'Audit reviewed if unexpected',
        'Internal note added if context matters',
        'Public page verified after visible changes',
      ],
      links: [
        { label: 'Open dashboard', to: '/admin', note: 'Return to main control center.' },
        { label: 'Open dealer manual', to: '/admin/dealer-guide', note: 'Compare dealer-side expectations.' },
      ],
    },
  ],
};

const dealerGuide: InternalGuideContent = {
  id: 'dealer',
  title: 'Dealer Dashboard Operating Manual',
  eyebrow: 'Private dealership documentation',
  subtitle:
    'A practical guide for dealer owners, managers, and editors: profile setup, service capabilities, images, represented models, listing creation, model-card overrides, team access, promotion requests, billing states, and admin review expectations.',
  quickLinks: [
    { label: 'Dealer dashboard', to: '/dealer/dashboard', note: 'Open the main dealership workspace.' },
    { label: 'Manage listings', to: '/dealer/listings', note: 'Open inventory management.' },
    { label: 'Create listing', to: '/dealer/listings?new=1', note: 'Start a new listing submission.' },
  ],
  sections: [
    {
      id: 'workspace-basics',
      title: 'Workspace Basics And Roles',
      summary:
        'Understand what the dealer workspace controls, what admins still review, and which team roles can perform sensitive actions.',
      icon: 'store',
      steps: [
        {
          title: 'Use the main dashboard as your command center',
          body:
            'The dashboard summarizes profile completion, listing count, represented models, enquiries, promotions, and team access. Start there when deciding what needs attention.',
          bullets: [
            'Profile completion tells you whether public dealer information is strong enough.',
            'Listings show inventory status and pending review work.',
            'Models show the EV models your dealership represents.',
            'Promotions show requests, quotes, payment state, and live campaign state.',
          ],
          links: [
            { label: 'Open dealer dashboard', to: '/dealer/dashboard', note: 'Main dealer workspace.' },
          ],
        },
        {
          title: 'Know the role levels',
          body:
            'Dealer owner is the primary dealership account. Managers can help operate the workspace and team. Editors can work on operational content but should not manage team access.',
          bullets: [
            'Use one account per person. Do not share passwords.',
            'If an action is hidden, your role or plan may not allow it.',
            'If the dealership needs more staff capacity, the dealer plan may need review.',
          ],
        },
        {
          title: 'Understand what requires platform review',
          body:
            'Profile edits can update your dealer page, but listings, dealer-created model cards, and promotions still involve platform review before public or paid visibility is guaranteed.',
          bullets: [
            'New listings are saved for review.',
            'New EV model submissions are pending until approved.',
            'Promotion requests are commercial requests, not instant ads.',
            'Admins may correct dealer profile data for quality, policy, or support reasons.',
          ],
        },
      ],
      links: [
        { label: 'Open dashboard', to: '/dealer/dashboard', note: 'Profile, models, promotions, team, and enquiries.' },
        { label: 'Open listing manager', to: '/dealer/listings', note: 'Inventory workflow.' },
      ],
    },
    {
      id: 'profile',
      title: 'Dealer Profile Setup',
      summary:
        'Your dealer profile is the public business record. Complete it carefully so buyers and admins can trust it.',
      icon: 'clipboard',
      steps: [
        {
          title: 'Fill the identity and contact fields',
          body:
            'Open the dealer dashboard profile form and complete dealership name, contact person, phone, email, website, city, address, languages, and description.',
          bullets: [
            'Name should match the business identity buyers know.',
            'Phone and email should reach the sales or dealership contact responsible for EV enquiries.',
            'City and address help public dealer discovery.',
            'Website should be a real dealership or business URL.',
          ],
          links: [
            { label: 'Open profile dashboard', to: '/dealer/dashboard#profile', note: 'Edit dealer profile data.' },
          ],
        },
        {
          title: 'Define brands and vehicle focus',
          body:
            'Use Brands you carry for manufacturer names such as BYD, Tesla, Volkswagen, Hyundai, Kia, Mercedes, BMW, MG, or others. Use vehicle focus for the type of inventory you handle.',
          bullets: [
            'Examples of vehicle focus: new EVs, used EVs, certified pre-owned, imports, city cars, SUVs, commercial vans, premium EVs, or budget EVs.',
            'Keep brand lists accurate. Do not add brands you cannot realistically source or support.',
            'If you deal both cars and services, explain that in the description and service notes.',
          ],
        },
        {
          title: 'Select service and support capabilities',
          body:
            'Choose only the capabilities your dealership can genuinely provide. These badges can appear publicly and help platform admins evaluate your profile.',
          bullets: [
            'EV service: you can service electric vehicles.',
            'Certified service: you have official or certified support for one or more brands.',
            'Parts supply: you can source EV parts.',
            'Battery diagnostics: you can diagnose battery or high-voltage issues.',
            'Charging installation: you can help customers with charger setup.',
            'Warranty support: you can support warranty processes.',
            'Trade-in, financing, and roadside assistance should be selected only when actually available.',
          ],
          warning:
            'If you claim certified service, use certification details to explain what is certified and by whom.',
        },
        {
          title: 'Use notes for limitations',
          body:
            'Certification details and service notes should explain brand coverage, partner workshops, appointment requirements, service areas, parts availability, and limitations.',
          bullets: [
            'Good note: Certified BYD service partner in Tirana; high-voltage technicians available by appointment.',
            'Good note: Battery diagnostics available for selected models; parts sourced through partner network.',
            'Poor note: We service everything. This is too vague and may require admin follow-up.',
          ],
        },
        {
          title: 'Save and verify the public profile',
          body:
            'After saving, open the public profile link from the dashboard and check the page as a buyer would see it.',
          bullets: [
            'Confirm contact details are correct.',
            'Confirm brands and service badges make sense.',
            'Confirm images are current.',
            'Confirm description is clear and not outdated.',
          ],
        },
      ],
      checklist: [
        'Name and contact person complete',
        'Phone and email usable',
        'City and address complete',
        'Brands accurate',
        'Service capabilities honest',
        'Certification details added when needed',
        'Public profile checked after saving',
      ],
      links: [
        { label: 'Open dealer dashboard', to: '/dealer/dashboard', note: 'Edit profile and public information.' },
      ],
    },
    {
      id: 'images',
      title: 'Images, Hero Photo, And Gallery',
      summary:
        'Use images to build buyer trust while keeping uploads practical and storage-friendly.',
      icon: 'camera',
      steps: [
        {
          title: 'Upload a strong hero image',
          body:
            'Use the profile image upload control for a clear dealership hero image. Good choices include showroom, storefront, branded exterior, delivery area, or professional inventory photo.',
          bullets: [
            'Use clear JPEG or PNG files.',
            'Avoid screenshots, blurry images, low-light images, or unrelated stock photos.',
            'If upload fails, try a smaller file and wait for the upload to complete before saving again.',
          ],
        },
        {
          title: 'Use gallery images for proof',
          body:
            'Gallery images should support trust: showroom, service area, inventory, staff, customer handover area, charger setup, or brand-specific display.',
          bullets: [
            'Remove old photos that no longer represent the dealership.',
            'Do not upload many nearly identical photos.',
            'Avoid photos containing sensitive documents, license plates if not intended, or private customer details.',
          ],
        },
        {
          title: 'After uploading, review the public page',
          body:
            'Open the public dealer profile and check image cropping, loading, and whether the gallery tells the right story.',
          result:
            'A complete profile with good images, accurate services, and clear contact details should need less admin clarification and inspire more buyer trust.',
        },
      ],
      links: [
        { label: 'Open dealer dashboard', to: '/dealer/dashboard', note: 'Manage profile image and gallery.' },
      ],
    },
    {
      id: 'models',
      title: 'Represented EV Models',
      summary:
        'Link existing EV model cards to your dealership or submit missing models for platform review.',
      icon: 'car',
      steps: [
        {
          title: 'Attach existing models first',
          body:
            'Search the available model list and attach EV models your dealership sells, imports, services, or represents. This is faster and keeps your profile aligned with the platform catalog.',
          bullets: [
            'Attach only models relevant to your dealership.',
            'Do not attach models only for keyword visibility.',
            'If a model is available but missing details, tell admins through notes or listing override reasons where appropriate.',
          ],
        },
        {
          title: 'Create a new model only when missing',
          body:
            'If a model does not exist in the catalog, create it from the dashboard. Add brand, model name, body type, battery, range, power, seats, charge port, image, gallery, and notes if available.',
          bullets: [
            'New dealer-created models are submitted for admin review.',
            'They are not automatically canonical public records.',
            'Use notes to explain trim, market version, source, or uncertainty.',
          ],
        },
        {
          title: 'Use model notes to reduce back-and-forth',
          body:
            'Good notes make admin approval faster. Include whether the model is a trim, regional variant, imported version, newly launched vehicle, or missing from the platform catalog.',
          bullets: [
            'Example: 77 kWh AWD version imported from EU market.',
            'Example: range value from WLTP source, not dealer estimate.',
            'Example: image is official press image for this model year.',
          ],
        },
      ],
      checklist: [
        'Existing model searched first',
        'Only relevant models attached',
        'New model specs completed',
        'Images added when available',
        'Notes added for variants or uncertainty',
      ],
      links: [
        { label: 'Open dealer dashboard', to: '/dealer/dashboard#models', note: 'Attach or submit represented models.' },
      ],
    },
    {
      id: 'listings',
      title: 'Listing Creation And Inventory Management',
      summary:
        'Create listings from existing model cards or from scratch, then monitor review and status from the listing manager.',
      icon: 'book',
      steps: [
        {
          title: 'Open the listing manager',
          body:
            'Use Manage listings to see your inventory. You can search, filter by status, create new listings, edit existing listings, hide/show where allowed, or delete listings you no longer want to manage.',
          bullets: [
            'Pending listings are waiting for platform review.',
            'Active or approved listings can appear publicly.',
            'Inactive listings are hidden or paused.',
            'Deleted listings are removed from normal dealer inventory views.',
          ],
          links: [
            { label: 'Manage listings', to: '/dealer/listings', note: 'Open inventory table.' },
            { label: 'Create listing', to: '/dealer/listings?new=1', note: 'Start a new listing.' },
          ],
        },
        {
          title: 'Choose a model card when it fits',
          body:
            'At the top of the listing form, choose an existing model profile when the vehicle matches a platform EV model. The form can copy make, model, body type, battery, range, and available model images.',
          bullets: [
            'This saves time and reduces typing errors.',
            'It connects your listing to the broader EV catalog.',
            'You can still customize vehicle-specific details such as year, mileage, price, location, and description.',
          ],
        },
        {
          title: 'Create from scratch when no model fits',
          body:
            'Leave the model profile empty if the vehicle is a one-off import, a missing model, or a variant that does not match available catalog cards. Fill all listing fields manually.',
          bullets: [
            'Use clear title, brand, model, year, mileage, battery, range, price, and location.',
            'Add enough description for a buyer to understand condition, trim, warranty, import status, and availability.',
          ],
        },
        {
          title: 'Explain copied model-card changes',
          body:
            'If you choose a model card and then change make, model, body type, battery capacity, or range, the form asks why. Choose the closest reason.',
          bullets: [
            'Submodel or trim: the exact vehicle is a trim that differs from the base card.',
            'Catalog error: the platform model card appears wrong.',
            'Market variant: the vehicle is from a different regional market.',
            'Dealer-specific configuration: this vehicle has a specific configuration.',
            'Other: add mandatory notes explaining the reason.',
          ],
          warning:
            'Do not use model-card changes to exaggerate range, battery, or specifications. Admins can see the original model snapshot and changed fields.',
        },
        {
          title: 'Upload listing images',
          body:
            'Use a clear primary image and a useful gallery. Images should show the exact vehicle where possible: front, rear, side, interior, dashboard, charging port, wheels, and condition details.',
          bullets: [
            'Avoid huge files and duplicate angles.',
            'Do not upload images that misrepresent the vehicle.',
            'If upload fails, retry with smaller files and wait for the upload to finish.',
          ],
        },
        {
          title: 'Submit and monitor review',
          body:
            'After saving, the listing may be pending. Platform admins review listing quality, ownership, images, model overrides, and public suitability before approval.',
          result:
            'A complete listing with accurate data, good images, and clear notes is more likely to be approved quickly.',
        },
      ],
      checklist: [
        'Existing model card used when appropriate',
        'Manual fields complete',
        'Override reason selected if copied model data changed',
        'Notes added when Other is selected',
        'Primary image uploaded',
        'Gallery images uploaded',
        'Status checked after submit',
      ],
      links: [
        { label: 'Create listing', to: '/dealer/listings?new=1', note: 'Open new listing form.' },
        { label: 'Manage listings', to: '/dealer/listings', note: 'Review inventory and statuses.' },
      ],
    },
    {
      id: 'promotions',
      title: 'Promotion Requests And Billing',
      summary:
        'Use promotions to request paid visibility. The platform still controls quotes, invoices, reservations, payments, campaign status, and public placement.',
      icon: 'megaphone',
      steps: [
        {
          title: 'Confirm your dealer plan eligibility',
          body:
            'Promotion requests may require paid-plan eligibility. If the request form is unavailable, your plan or subscription state may not allow campaign purchases yet.',
          bullets: [
            'Paid dealer status can allow promotion eligibility.',
            'Eligibility does not guarantee a placement slot.',
            'Platform admins control final placement availability and scheduling.',
          ],
        },
        {
          title: 'Start a new promotion request',
          body:
            'Open Promotions and billing on the dashboard and click New promotion request. Choose the sponsorship product, promotion target, compatible zones, preferred start/end dates, and notes.',
          bullets: [
            'Dealer spotlight promotes the dealership.',
            'Listing spotlight promotes a specific vehicle listing.',
            'Model-related placement promotes association with an EV model.',
            'Use notes for campaign goals, preferred wording, or timing constraints.',
          ],
          links: [
            { label: 'Open dealer dashboard', to: '/dealer/dashboard#promotions', note: 'Promotion request workflow.' },
          ],
        },
        {
          title: 'Understand order statuses',
          body:
            'A submitted request creates a sponsorship order. Status and payment status explain where it is in the commercial process.',
          bullets: [
            'Draft: request received or incomplete.',
            'Quoted: platform has prepared commercial terms.',
            'Reserved: inventory may be held for the date range.',
            'Paid or active: commercial state is satisfied or campaign is active.',
            'Cancelled or expired: request should not deliver active visibility.',
            'Unpaid, pending, partial, paid, refunded, or waived describe payment state.',
          ],
        },
        {
          title: 'Know why a paid request may not show publicly',
          body:
            'Public visibility depends on a linked promotional campaign, active/scheduled status, valid dates, zone availability, entity compatibility, and platform approval.',
          warning:
            'A paid or waived order alone does not mean the ad is live. If visibility is missing, ask support to check the linked campaign and zone resolution.',
        },
        {
          title: 'Cancel only draft or quoted requests',
          body:
            'You can cancel requests that are still draft or quoted. Once reserved, paid, active, expired, or otherwise processed, contact platform support for changes.',
        },
      ],
      checklist: [
        'Plan eligibility checked',
        'Correct sponsorship product selected',
        'Promotion target selected',
        'Compatible zones selected',
        'Preferred dates entered',
        'Notes added',
        'Order and payment status monitored',
      ],
      links: [
        { label: 'Open promotions', to: '/dealer/dashboard#promotions', note: 'Promotion requests and billing status.' },
      ],
    },
    {
      id: 'team-access',
      title: 'Dealer Team Access',
      summary:
        'Invite dealership staff safely and remove access when it is no longer needed.',
      icon: 'users',
      steps: [
        {
          title: 'Invite staff with their own email',
          body:
            'Owners and managers can create invite links for staff. Enter the staff email, choose the role, create the invite, then send the link only to that person.',
          bullets: [
            'Do not share the owner account password.',
            'Use manager for trusted operational admins.',
            'Use editor for staff who should edit content or inventory but not manage access.',
          ],
          links: [
            { label: 'Open team section', to: '/dealer/dashboard#team', note: 'Manage staff and invites.' },
          ],
        },
        {
          title: 'Copy or revoke pending invites',
          body:
            'Pending invites show status, email, role, and invite URL. Copy the invite URL when needed. Revoke it if it was sent to the wrong person or is stale.',
          bullets: [
            'Revoked invites cannot be accepted.',
            'Expired invites require a new invite.',
            'If capacity is full, remove unused staff or request plan review.',
          ],
        },
        {
          title: 'Remove staff who should no longer access the workspace',
          body:
            'Use Remove on an active staff member when they leave the dealership or no longer need access.',
          warning:
            'Removing staff affects their dealer workspace access. Confirm the correct user before removing.',
        },
      ],
      checklist: [
        'One account per person',
        'Correct role selected',
        'Invite link sent only to intended email',
        'Stale invites revoked',
        'Former staff removed',
      ],
      links: [
        { label: 'Open dealer dashboard', to: '/dealer/dashboard#team', note: 'Dealer team management.' },
      ],
    },
    {
      id: 'enquiries',
      title: 'Enquiries And Buyer Follow-Up',
      summary:
        'Use recent enquiries as buyer-intent signals and respond outside the dashboard using the contact details provided.',
      icon: 'bell',
      steps: [
        {
          title: 'Review recent enquiries',
          body:
            'The dealer dashboard shows recent listing enquiries associated with your dealership. Review name, contact details, message, listing context, and creation time.',
          bullets: [
            'Respond quickly using the provided phone or email.',
            'If an enquiry references a listing that is no longer available, update or hide the listing.',
            'If spam appears repeatedly, report it to platform support.',
          ],
        },
        {
          title: 'Keep listings accurate after enquiries',
          body:
            'If a vehicle is sold, reserved, price-changed, or no longer available, update the listing so future buyers are not misled.',
          links: [
            { label: 'Manage listings', to: '/dealer/listings', note: 'Update inventory after buyer contact.' },
          ],
        },
      ],
      links: [
        { label: 'Open dealer dashboard', to: '/dealer/dashboard#enquiries', note: 'Recent buyer enquiries.' },
      ],
    },
    {
      id: 'admin-review',
      title: 'Admin Review, Corrections, And Troubleshooting',
      summary:
        'Know how platform admins review dealer content and what to do when something is pending, hidden, rejected, or not visible.',
      icon: 'shield',
      steps: [
        {
          title: 'Understand what admins can control',
          body:
            'Platform admins can approve or reject dealer profiles, edit dealer information, correct service capability claims, change dealer plan status, manage owner/staff relationships, moderate listings, review model submissions, and control paid placements.',
          bullets: [
            'Admins may force-correct incorrect public information.',
            'Admins may reject or hide content that is incomplete, misleading, or not platform-appropriate.',
            'Admins can see model-card override reasons and original snapshots.',
          ],
        },
        {
          title: 'If your listing is pending',
          body:
            'Check whether all required data, images, price, location, and model override notes are complete. Pending means it is waiting for admin review.',
          links: [
            { label: 'Manage listings', to: '/dealer/listings', note: 'Check listing status and edit if needed.' },
          ],
        },
        {
          title: 'If your promotion is not visible',
          body:
            'Check request status, payment status, dates, and whether a campaign is live. If order status looks paid or active but the ad is missing, ask platform support to check campaign linkage and placement-zone resolution.',
        },
        {
          title: 'If image upload fails',
          body:
            'Try a smaller file, wait for upload completion, and avoid unsupported or extremely large images. If it still fails, send the exact dashboard area, file type, and approximate file size to support.',
        },
        {
          title: 'If access is missing',
          body:
            'Confirm you are logged in with the invited email, your invite is accepted, your dealer account is active, and your staff role allows the action.',
        },
      ],
      checklist: [
        'Correct account used',
        'Dealer profile active',
        'Listing status checked',
        'Required notes completed',
        'Payment/order status checked for promotions',
        'Support contacted with exact context if still blocked',
      ],
      links: [
        { label: 'Open dealer dashboard', to: '/dealer/dashboard', note: 'Main troubleshooting starting point.' },
        { label: 'Open listings', to: '/dealer/listings', note: 'Inventory status and edits.' },
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
