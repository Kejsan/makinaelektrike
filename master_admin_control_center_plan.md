# Master Admin Control Center Plan

Status: Draft  
Last updated: 2026-04-30  
Scope: Platform-wide admin architecture, access control, moderation, analytics, monetization controls, and operational tooling

## Purpose

This document defines the plan for evolving Makina Elektrike from its current single-role admin dashboard into a full platform control center with:

- a true `master_admin` capability
- granular admin roles and scoped permissions
- a structured dealer monetization model with `Free` and `Paid` dealer tiers
- full control over users, dealers, listings, EV models, charging stations, blog content, and support flows
- full control over dynamic promotional inventory and paid placement visibility throughout the platform
- safer backend authority for privileged operations
- auditability, restoreability, and operational visibility

This is intended to be the canonical reference for the admin control-center redesign and rollout.

## Executive Summary

The current platform already has a usable moderation console and dealer dashboard, but it is not yet a true operations-grade admin system.

The main limitations are:

- access control is fundamentally flat and binary
- privileged operations still happen too directly from the browser
- there is no user-management surface
- there is no admin-management or access-control surface
- there is no audit log, revision history, or internal notes system
- data visualization is limited to counts and filtered lists
- canonical catalog data and dealer-controlled data are not separated strongly enough
- there is no formal dealer plan model separating free and paid participation
- there is no dynamic monetization or sponsored-placement control layer

The target outcome is:

- one `master_admin` tier with full control over the entire platform
- multiple lower admin tiers such as content-only, catalog-only, dealer/user-ops, charging-only, and analyst
- a clean commercial split between `Free` dealers, `Paid` dealers, and optional sponsored placement products
- a proper access-control panel for adding admins and controlling what they can do
- entity-level and action-level control across users, dealers, listings, models, stations, blog posts, and enquiries
- master-admin-controlled promotional inventory across dynamic placement zones on key frontend pages
- a safer server-driven permission model backed by audit logs
- a more scalable admin UI with routed modules instead of one oversized tabbed page

## Current-State Audit

### 1. Current Access Model

Current access is built around a single `UserRole` union in [types.ts](types.ts):

- `admin`
- `dealer`
- `user`
- `pending`

Relevant files:

- [types.ts](types.ts)
- [App.tsx](App.tsx)
- [contexts/AuthContext.tsx](contexts/AuthContext.tsx)
- [firestore.rules](firestore.rules)
- [storage.rules](storage.rules)

Observed behavior:

- admin route access is effectively `role === 'admin'`
- dealer route access is effectively `role === 'dealer'` plus dealer approval status
- Firestore and Storage rules only understand a broad `isAdmin()` concept
- there is no native concept of `master_admin`, `support_admin`, `content_admin`, `catalog_admin`, or read-only analyst
- there is no scoped admin access by entity, locale, dealer, or task category

Assessment:

- good enough for one broad operator role
- not good enough for multi-admin operations
- not good enough for least-privilege access
- not good enough for long-term governance or security

### 2. Current Admin Dashboard Surface

The current admin dashboard is centered in [pages/AdminPage.tsx](pages/AdminPage.tsx).

Current tabs:

- dealers
- models
- listings
- blog
- stations
- migration

What already works reasonably well:

- search and filtering on multiple entity types
- bulk actions for dealers, models, listings, blog posts, and stations
- dealer approval/rejection/deactivation/reactivation
- model hide/show and featured toggles
- listing moderation
- blog draft/publish editing
- charging-station CRUD
- bulk import flows for dealers, models, and blog content
- offline queue visibility
- migration/export tooling

What does not exist in the current admin UI:

- users tab
- admins tab
- access control panel
- audit log
- revision history
- internal notes
- support tooling
- session management
- impersonation or shadow-access tools
- explicit approval queues dashboard
- charts, trends, operational maps, or quality metrics

Assessment:

- capability coverage: medium
- control granularity: low
- operations visibility: low
- usability for one operator: acceptable
- usability for a larger team: weak

### 3. Current Dealer Dashboard Surface

The current dealer dashboard is in [pages/DealerDashboardPage.tsx](pages/DealerDashboardPage.tsx).

Current dealer capabilities:

- edit dealer profile and public information
- upload/update imagery
- link existing EV models to dealer
- create a new model and link it
- see recent enquiries
- navigate to dealer listings management

Important limitation:

- there is no concept of dealer staff roles or multiple dealership team members
- the model catalog is still too writable from dealer-facing surfaces
- master-admin control over dealer-originated changes is not strong enough

### 4. Current Data Governance and Entity Ownership

Observed entity behaviors:

- dealers are partly moderation-managed and partly owner-managed
- listings are dealer-owned but approval-moderated
- models can be created and edited by admins and dealers
- charging stations are admin-managed
- blog posts are admin-managed
- user profiles are mostly self-managed, not operationally managed

Important structural issue:

the platform currently mixes business records, identity records, and moderation state too loosely.

Examples:

- dealer registration creates both a user and a dealer record in [contexts/AuthContext.tsx](contexts/AuthContext.tsx)
- some dealer flows assume a dealer record is tightly coupled to a user UID
- other dealer flows treat dealers as standalone business records
- dealer activation is still handled from the browser in [pages/AdminPage.tsx](pages/AdminPage.tsx)

This must be normalized before granular admin control will remain coherent.

### 5. Current Security and Backend Authority

Current privileged behavior is still too client-heavy.

Examples:

- user registration and dealer registration are direct browser auth flows
- dealer activation creates auth accounts from the browser
- several privileged entity writes are still direct Firestore client writes
- current rule logic is not expressive enough for the planned permission model

Implication:

before improving the dashboard visually, privileged authority must move to trusted backend functions for admin-grade operations.

### 6. Current Data Visualization and Ease of Use

What exists:

- status counters
- searchable lists
- filtered tables
- bulk selection actions

What is missing:

- growth trends
- moderation throughput
- approval backlog widgets
- dealer health/completeness reports
- listing pipeline analytics
- geo dashboards for charging stations and dealers
- admin activity trends
- abuse/security signals
- saved views and operational work queues

Assessment:

- data visualization maturity: low
- admin operability maturity: medium-low

### 7. Current Monetization and Placement Control

There is currently no internal control system for selling, scheduling, rotating, or governing paid promotional placements across the platform.

What is missing:

- placement zones defined at the platform level
- sponsored inventory management
- paid-vs-organic visibility rules
- scheduling, prioritization, and fallback content
- placement analytics such as impressions, clicks, and fill rate
- admin control over where dealers, models, listings, or services are highlighted
- a non-static frontend rendering model for promotions

Implication:

if monetization is added later without being integrated into the master-admin plan, it will create a second control system and a second layer of page logic. That would be the wrong architecture.

## Design Principles

The redesign should follow these principles:

1. Master admin must have total control, but lower admin roles must be least-privilege by default.
2. UI permissions and backend permissions must match exactly.
3. Sensitive operations should move behind trusted backend functions.
4. Audit logging is mandatory for privileged actions.
5. Canonical platform data must be separated from dealer-submitted or dealer-owned data.
6. Soft-delete and restore should be preferred over permanent destructive actions.
7. Admin UX should scale from one operator to a team without becoming a monolithic page.
8. Granularity should be practical: resource + action + scope, with selected field groups where needed.
9. Promotional and monetized placements should be config-driven and admin-controlled, not hardcoded into page layouts.

## Target Operating Model

### 1. Admin Role Strategy

Recommended built-in admin presets:

| Role | Purpose | Typical Scope |
|---|---|---|
| `master_admin` | Full platform authority | Everything, including admin governance and settings |
| `platform_ops_admin` | Broad operational control below master admin | Users, dealers, listings, enquiries, moderation |
| `dealer_ops_admin` | Dealer and inventory operations | Dealers, dealer staff, listings, enquiries |
| `user_support_admin` | Support and account remediation | Users, suspensions, profile edits, read-only support access |
| `catalog_admin` | Canonical EV model and taxonomy management | Models, dealer-model mappings, catalog quality |
| `charging_admin` | Charging-station operations | Stations, geo data, verification, cleanup |
| `content_admin` | Editorial operations | Blog, publishing, SEO fields, content workflow |
| `analyst` | Read-only operational visibility | Dashboards, exports, audit visibility |

Important note:

these roles should be presets, not the final permission mechanism. The real authority model should be custom permission bundles with scopes.

### 2. Permission Model

Use a permission model built from:

- `resource`
- `action`
- `scope`

Examples of resources:

- `users`
- `dealers`
- `dealer_staff`
- `listings`
- `models`
- `stations`
- `blog`
- `enquiries`
- `admins`
- `audit`
- `settings`
- `reports`

Examples of actions:

- `read`
- `create`
- `edit`
- `delete`
- `soft_delete`
- `restore`
- `approve`
- `reject`
- `publish`
- `hide`
- `assign_owner`
- `assign_role`
- `invite`
- `export`
- `impersonate_readonly`
- `manage_settings`

Examples of scopes:

- global
- specific dealer IDs
- specific locales
- read-only
- selected entity groups
- temporary access windows

Examples of permission keys:

- `users.read`
- `users.edit`
- `users.suspend`
- `users.reactivate`
- `dealers.approve`
- `dealers.edit`
- `dealers.manage_staff`
- `listings.moderate`
- `listings.reassign`
- `models.publish`
- `models.merge`
- `stations.edit`
- `stations.merge`
- `blog.publish`
- `blog.schedule`
- `admins.invite`
- `admins.assign_permissions`
- `audit.view`
- `reports.export`

### 3. Platform Member Entitlements

Separate admin permissions from platform-member entitlements.

For regular users and dealers, the control center should also manage:

- whether an account is active, pending, suspended, disabled, or archived
- whether a dealer can create listings
- whether a dealer requires review before publication
- whether a dealer can propose EV model changes
- whether a dealer can manage staff
- whether a user can submit certain forms or access certain premium flows
- listing limits or dealer-plan-style constraints if those are introduced later

This gives master admin meaningful control over how users and dealers behave on the platform without turning them into admins.

### 4. Dealer Plan Model and Commercial Entitlements

The recommended commercial model for dealers is:

- `Free Dealer`
- `Paid Dealer`
- optional sponsored-placement add-ons layered on top of `Paid Dealer`

Reason:

- it keeps entry friction low for marketplace growth
- it makes the paid tier clearly about business performance, not basic legitimacy
- it separates subscription value from promotional inventory value
- it keeps master admin in control of all promoted visibility

Recommended `Free Dealer` baseline:

- one owner account
- a basic public dealer profile
- a limited active listing quota
- standard enquiry handling
- basic photo/media limits
- standard organic visibility only
- basic reporting such as profile views, listing views, and enquiries

Recommended `Paid Dealer` baseline:

- higher or unlimited listing capacity
- richer dealer profile presentation
- richer media support such as larger galleries and video
- more advanced lead-handling tools
- more detailed analytics and performance reporting
- multiple dealer staff accounts
- stronger operational tooling and potentially faster support
- eligibility to purchase sponsored placements

Important rule:

`Paid Dealer` should create eligibility for premium placement products, but should not guarantee permanent or static visibility in high-value zones. Final visibility must remain governed by master-admin rules, placement assignments, schedules, and policy constraints.

Recommended commercial distinction:

- `dealer_plan`: subscription-style entitlement layer
- `promotion_product`: optional exposure or sponsorship add-on

Examples of promotion products:

- featured dealer spot
- featured listing spot
- featured EV model spot
- sponsored blog placement
- sponsored services placement
- charging-page promotional block

Recommended plan-related dealer entitlements:

- max active listings
- max staff accounts
- richer profile modules enabled or disabled
- richer media limits
- advanced analytics access
- featured-placement eligibility
- campaign-purchase eligibility

What should not be sold:

- approval bypass
- moderation bypass
- false trust signals
- permanent hardcoded homepage placement
- immunity from quality rules or ranking policy

### 5. Monetization and Placement Governance

This should remain part of the main master-admin operating model, not a disconnected plan.

Reason:

- the same master-admin and permission model must govern placements
- the same audit layer must record promo changes
- the same routed admin UI should expose placement control
- the same frontend should render dynamic zones instead of hardcoded highlighted blocks

Recommended first-class concepts:

- `dealer_plans`: free vs paid plan definitions and entitlements
- `dealer_subscriptions`: which plan a dealer currently has and when it applies
- `placement_zones`: named areas on the site where promotional content may appear
- `promotional_campaigns`: the sponsored or house-promo units being scheduled
- `placement_assignments`: which campaign is eligible for which zone and when
- `sponsorship_products`: optional internal definitions for paid packages such as homepage highlight, listing-page promo, or blog-article sponsor slot

Placement zones should exist for surfaces such as:

- listings index pages
- dealers index pages
- models index pages
- single model pages
- blog index pages
- blog article pages
- charging stations pages
- any services or support pages where promotions are commercially appropriate

The master admin should be able to:

- assign, upgrade, downgrade, pause, or expire dealer plans
- control which plans are eligible for which sponsorship products
- create, rename, enable, disable, and retire placement zones
- decide which entity types are allowed in each zone
- decide whether a zone supports paid promos, house promos, or both
- manually pin or unpin specific dealers, models, listings, or services
- schedule campaigns with start and end times
- pause or override campaigns instantly
- set priority, rotation behavior, and fallback content
- control geographic, locale, or page-context targeting where needed
- see exactly where and why a promo is visible

Recommended placement permissions:

- `dealer_plans.read`
- `dealer_plans.assign`
- `dealer_plans.override`
- `placements.read`
- `placements.create`
- `placements.edit`
- `placements.assign`
- `placements.publish`
- `placements.pause`
- `placements.override`
- `placements.analytics_read`
- `placements.billing_read`

## Entity Governance Model

### 1. Users

Master admin and authorized support/admin roles should be able to:

- search and filter all users
- open a full user profile
- edit profile fields
- suspend/reactivate/disable accounts
- revoke sessions
- trigger password reset flows safely
- inspect dealer memberships
- inspect favorites and activity summaries where useful
- attach internal notes
- inspect audit history

### 2. Dealers

Authorized admins should be able to:

- approve, reject, suspend, reactivate, and archive dealer profiles
- edit all public dealer profile data
- assign or replace the owner account
- manage future dealer staff memberships
- inspect linked listings, linked models, and enquiries
- inspect notes and history
- control dealer entitlements
- assign and change dealer plan tier
- control plan-related limits and overrides

### 3. Listings

Authorized admins should be able to:

- view moderation queues
- approve, reject, hide, archive, restore, and soft-delete listings
- edit any listing field
- reassign dealer ownership where necessary
- see status history and moderation reasons
- run bulk moderation safely

### 4. EV Models

Recommended target:

- canonical EV model records become platform-governed
- dealer-created changes become proposals or submissions, not immediate canonical mutations

Authorized admins should be able to:

- edit any EV model field
- manage media and translations
- publish/hide/archive models
- merge duplicates
- resolve dealer-submitted model suggestions
- inspect usage across dealers and listings

### 5. Charging Stations

Authorized admins should be able to:

- edit every station field
- hide/show/archive/delete/restore
- fix coordinates
- merge duplicates
- mark verification state
- inspect stale or low-quality data
- use both table and map workflows

### 6. Blog Posts

Authorized admins should be able to:

- create and edit all blog content
- publish/unpublish/schedule
- edit SEO fields and metadata
- manage translations
- inspect revision history
- manage authorship and editorial permissions

### 7. Admin Accounts

Master admin should be able to:

- invite new admins
- assign presets or custom permission bundles
- define scopes
- set temporary access expirations
- revoke access immediately
- inspect effective permissions
- inspect admin activity history

### 8. Promotional Placements and Sponsored Inventory

Authorized admins, and always the master admin, should be able to:

- define every monetizable placement zone on the platform
- choose whether a zone highlights dealers, listings, models, blog content, services, or house campaigns
- promote specific records manually
- attach promotions to schedules and visibility windows
- pause placements globally or per page/zone
- decide the fallback state when no paid placement is active
- preview how placements render across page types
- inspect performance and delivery metrics

Recommended business distinction:

- `house_promotion`: internal platform promotion controlled by admins
- `sponsored_promotion`: paid placement sold to dealers or partners

Recommended policy distinction:

- `Paid Dealer` status allows a dealer or listing to be eligible for sponsored inventory
- actual assignment into a zone remains controlled by placement logic and master-admin overrides

This distinction allows the same rendering system to support both monetization and internal merchandising without hardcoded page exceptions.

## Target Admin UI Architecture

Do not continue scaling everything inside the current single [pages/AdminPage.tsx](pages/AdminPage.tsx).

Recommended route structure:

- `/admin/overview`
- `/admin/users`
- `/admin/dealers`
- `/admin/listings`
- `/admin/models`
- `/admin/stations`
- `/admin/blog`
- `/admin/enquiries`
- `/admin/placements`
- `/admin/access`
- `/admin/audit`
- `/admin/reports`
- `/admin/system`

Recommended page structure:

- a shared `AdminLayout`
- role-aware sidebar navigation
- global search / command palette
- saved filters and queue views
- list pages with bulk actions
- entity detail pages or drawers with consistent tabs

Recommended placement-management surfaces:

- zone directory
- campaign directory
- assignment calendar or schedule view
- promo preview surface by page type
- analytics view for impressions, clicks, and fill rate

Recommended entity detail tabs:

- Overview
- Relationships
- Access
- Notes
- History

### Ease-of-Use Requirements

The new admin UI should include:

- consistent action bars across pages
- bulk actions with confirmation and undo-friendly design
- saved filters and queue presets
- strong search across entities
- role-aware navigation that hides irrelevant modules
- relationship visibility between users, dealers, listings, models, and content
- internal notes for operational coordination
- history views for trust and recoverability

## Data Visualization and Reporting Plan

### 1. Overview Dashboard

Initial dashboard widgets should include:

- pending dealer approvals
- pending listing approvals
- new users in last 24 hours / 7 days / 30 days
- active dealers
- dealers with incomplete profiles
- enquiry volume
- draft/published blog counts
- stations added or hidden recently
- EV models missing critical specs or media
- recent admin actions

### 2. Trend Visualizations

Recommended charts:

- user registrations over time
- dealer approvals over time
- listing submissions and approval rate
- enquiry volume trend
- charging-station growth
- model-catalog completeness
- content publishing cadence

### 3. Geographic Views

Recommended map-based admin views:

- charging stations by status
- dealers by region
- listings by area if location data is sufficiently structured
- stale geographic data needing cleanup

### 4. Operational Quality Reports

Recommended reports:

- dealers missing core profile fields
- listings stuck in moderation
- models missing range, power, or media
- charging stations without valid coordinates
- blog posts missing metadata
- suspended or anomalous accounts

### 5. Monetization and Promo Performance

Recommended placement reports:

- dealers by plan tier
- active paid subscriptions
- dealers eligible for sponsored placements but not currently assigned
- active sponsored campaigns
- zones with no fallback configured
- zones with low fill rate
- impressions by zone
- clicks by campaign
- click-through rate by campaign
- promoted dealer/listing/model visibility distribution
- expired campaigns still assigned anywhere

## Technical Architecture Plan

### 1. Identity and Access Data Model

Recommended user document evolution:

- replace sole reliance on `role`
- introduce `accountType`
- introduce `accountStatus`
- introduce `adminRoleIds`
- introduce `directPermissions`
- introduce `permissionScopes`
- introduce `lastRoleSyncAt`

Recommended new collections:

- `permissionSets`
- `adminInvites`
- `dealerMemberships`
- `dealerPlans`
- `dealerSubscriptions`
- `auditLogs`
- `adminNotes`
- `dashboardStats`

Recommended optional workflow collections:

- `modelSubmissions`
- `stationSubmissions`
- `listingModerationEvents`
- `userFlags`

Important implementation note:

Detailed permission bundles should live in Firestore. Custom claims should only carry coarse access markers and a role/version sync marker, not the full permission matrix.

### 2. Backend Admin Authority

Privileged operations should move behind trusted backend functions.

Likely new backend responsibilities:

- create admin invite
- accept admin invite
- assign admin permissions
- revoke admin access
- assign dealer plans
- activate, pause, or expire plan entitlements
- approve/reject/suspend dealers
- activate dealer owner accounts
- disable/reactivate users
- reassign dealer ownership
- perform high-sensitivity edits with audit logging
- export sensitive reports

Recommended file areas:

- `netlify/functions/admin-invite-create.ts`
- `netlify/functions/admin-invite-accept.ts`
- `netlify/functions/admin-assign-permissions.ts`
- `netlify/functions/admin-dealer-plan-update.ts`
- `netlify/functions/admin-user-update.ts`
- `netlify/functions/admin-dealer-update.ts`
- `netlify/functions/admin-listing-moderate.ts`
- `netlify/functions/admin-model-review.ts`
- `netlify/functions/admin-station-update.ts`
- shared helpers in `netlify/functions/_lib/*`

### 3. Firestore Rules Changes

Rules should be redesigned to support:

- coarse admin gating via trusted user/admin metadata
- scoped direct writes only where still appropriate
- denial of direct privileged writes where backend mediation is required
- safer canonical-data protection

Likely collections needing major rule changes:

- `users`
- `dealers`
- `listings`
- `models`
- `dealerModels`
- `charging_stations`
- future admin/access collections

### 4. Storage Rules Changes

Storage should evolve to support:

- scoped admin access
- dealer staff ownership patterns if introduced
- canonical model media vs dealer-uploaded media separation
- safer media governance for admin-managed assets

### 5. Frontend Refactor Plan

Likely files/modules to introduce:

- `pages/admin/AdminLayout.tsx`
- `pages/admin/AdminOverviewPage.tsx`
- `pages/admin/AdminUsersPage.tsx`
- `pages/admin/AdminDealersPage.tsx`
- `pages/admin/AdminDealerPlansPage.tsx`
- `pages/admin/AdminListingsPage.tsx`
- `pages/admin/AdminModelsPage.tsx`
- `pages/admin/AdminStationsPage.tsx`
- `pages/admin/AdminBlogPage.tsx`
- `pages/admin/AdminPlacementsPage.tsx`
- `pages/admin/AdminAccessPage.tsx`
- `pages/admin/AdminAuditPage.tsx`

Likely supporting component areas:

- `components/admin/users/*`
- `components/admin/dealers/*`
- `components/admin/dealer-plans/*`
- `components/admin/listings/*`
- `components/admin/models/*`
- `components/admin/stations/*`
- `components/admin/blog/*`
- `components/admin/placements/*`
- `components/admin/access/*`
- `components/admin/audit/*`

Likely supporting service areas:

- `services/admin/*`
- `hooks/admin/*`

### 6. Promotional Inventory Architecture

Recommended promo-related collections:

- `dealerPlans`
- `dealerSubscriptions`
- `sponsorshipProducts`
- `placementZones`
- `promotionalCampaigns`
- `placementAssignments`
- `placementAnalyticsDaily`

Recommended campaign fields:

- name
- status
- promotion type
- eligibility rules
- sponsored entity type
- sponsored entity ID
- target zones
- start and end dates
- priority
- rotation settings
- locale targeting
- page-context targeting
- fallback behavior
- createdBy
- updatedBy
- createdAt
- updatedAt

Recommended backend responsibilities:

- validate dealer-plan eligibility for paid inventory
- validate zone/campaign compatibility
- enforce scheduling rules
- compute active campaign resolution
- pause/resume campaigns immediately
- record audit events for visibility changes
- optionally record impression and click events for reporting

Recommended frontend approach:

- page-level promo slots should resolve dynamically from placement-zone configuration
- highlighted dealers/models/listings/services should be queried by placement assignment, not hardcoded in page markup
- every major page type should be able to render zero, one, or multiple placement zones without manual code branching per sponsor
- subscription tier alone should not hardcode promoted visibility into any page

## Phased Implementation Plan

### Phase 0: Architecture Freeze and Detailed Specification

Goals:

- finalize the access model
- finalize target data model
- finalize whether privileged ops stay on Netlify functions or move partly to Firebase-native backend logic

Deliverables:

- confirmed schema changes
- confirmed role presets
- confirmed permission key list
- confirmed route map
- confirmed rollout order

Acceptance criteria:

- no major unresolved structural decisions remain

### Phase 1: Permission Foundation and Security Hardening

Goals:

- introduce the new permission model
- move the most sensitive privileged actions behind trusted backend functions
- stop relying on broad client-side admin power for critical flows

Deliverables:

- permission schema
- admin invite flow foundation
- backend helpers for privileged writes
- updated Firestore rules
- updated Storage rules

Acceptance criteria:

- master admin exists as a distinct capability
- lower admin permissions can be expressed without code branching on a single `role`
- sensitive admin actions are backend-mediated

### Phase 2: Access Control Panel

Goals:

- allow master admin to create and manage other admins
- allow assignment of preset roles and custom scopes

Deliverables:

- `/admin/access`
- admin list view
- admin detail view
- invite flow
- effective-permission preview
- revoke access flow

Acceptance criteria:

- a new admin can be created without manual database editing
- blog-only, catalog-only, and dealer/user-ops admin roles are assignable
- access changes are auditable

### Phase 3: Users and Dealers Control Center

Goals:

- add full user and dealer operational control
- establish dealer plan and entitlement management

Deliverables:

- `/admin/users`
- `/admin/dealers`
- `/admin/dealer-plans`
- user detail view
- dealer detail view
- dealer plan assignment and override controls
- internal notes
- audit history
- account suspension/reactivation
- dealer ownership and staff controls

Acceptance criteria:

- master admin can open and edit any user or dealer profile
- authorized admins can manage access and status safely
- dealer tiers can be managed without manual data editing

### Phase 4: Listings and Enquiries Operations

Goals:

- improve inventory moderation and support workflow handling

Deliverables:

- stronger listing queues
- moderation reasons/history
- dealer/listing relationship visibility
- enquiry operational view

Acceptance criteria:

- listing moderation is faster and more auditable
- operators can move through queues without opening multiple unrelated screens

### Phase 5: Models, Stations, and Blog Governance

Goals:

- separate canonical data from submissions
- make catalog/content/station administration more controlled and restorable

Deliverables:

- canonical model governance flow
- model submission review flow
- improved charging-station management
- blog revision/publishing improvements

Acceptance criteria:

- admins can control every EV model, station, and blog post
- dealer-originated changes no longer bypass governance for canonical data

### Phase 6: Monetization and Promotional Placement Control

Goals:

- introduce the `Free` vs `Paid` dealer model
- make promotional inventory a governed, monetizable, and fully admin-controlled platform capability

Deliverables:

- dealer plan definitions
- dealer subscription / entitlement layer
- `/admin/placements`
- placement-zone model
- sponsorship product model
- promotional campaign model
- dynamic assignment and scheduling
- frontend placement rendering on major page types
- master-admin overrides and pause controls

Acceptance criteria:

- free vs paid dealer entitlements are enforced consistently
- paid dealers can be marked eligible for premium inventory without receiving guaranteed static placement
- the platform can promote dealers, listings, models, blog content, and services dynamically
- promoted visibility is fully under master-admin control
- no page depends on hardcoded sponsored placement content

### Phase 7: Analytics, Reporting, and Admin Activity Visibility

Goals:

- give master admin and analysts platform-wide situational awareness

Deliverables:

- `/admin/overview`
- `/admin/reports`
- dashboard cards
- trend charts
- geo dashboards
- quality reports
- admin activity widgets

Acceptance criteria:

- leadership and operators can understand platform health without manually inspecting collections

### Phase 8: Migration, Rollout, and Hardening

Goals:

- move safely from the old model to the new one

Deliverables:

- migration scripts
- backfilled permissions and memberships
- seeded master admins
- rollback notes
- rollout checklist

Acceptance criteria:

- production data is preserved
- old access paths are removed or deprecated cleanly
- no unowned entity class is left behind

## Testing Strategy

Required test layers:

- Firestore rules tests
- Storage rules tests
- backend permission tests
- admin invite flow tests
- role-based UI regression tests
- migration verification tests

Recommended fixtures:

- one master admin
- one platform ops admin
- one content admin
- one catalog admin
- one user support admin
- one analyst
- one approved dealer
- one pending dealer
- one normal user

## Migration Strategy

Recommended migration steps:

1. introduce new fields and collections without removing legacy `role`
2. backfill existing users and dealer relationships
3. seed first `master_admin` accounts manually
4. deploy backend permission functions
5. deploy updated rules
6. release new admin routes behind a controlled flag or staged rollout
7. cut over entity by entity
8. remove or narrow obsolete direct-write paths

Important migration concerns:

- dealer/account relationships must be reconciled carefully
- current dealer activation behavior should be retired in favor of trusted backend flows
- any hard-delete behavior should be reviewed before rollout

## Out of Scope for Initial Rollout

These are valuable, but they should not block the first meaningful admin-control release:

- a fully arbitrary per-field ACL designer for every property in the database
- full BI warehouse integration
- advanced workflow automation
- multi-organization white-label admin partitioning

The first release should prioritize:

- secure authority
- granular admin control
- user/dealer/entity management
- auditability
- operational visibility

## Recommended Immediate Next Actions

1. Approve this plan as the canonical direction.
2. Freeze the target permission model before UI expansion.
3. Implement the permission foundation and backend mediation first.
4. Build `/admin/access` and `/admin/users` before adding more charts.
5. Refactor the admin area into routed modules instead of extending the current single page indefinitely.
6. Treat paid placements as dynamic admin-governed inventory, not static frontend content.
7. Separate dealer subscription value from promotional placement value from the start.

## Summary

The current platform has a workable moderation console, but not yet the operating system a master admin needs.

The path forward is:

- normalize identity and permissions
- move sensitive authority server-side
- build a true access-control layer
- add a structured `Free` vs `Paid` dealer plan model
- expand entity management across users, dealers, listings, models, stations, blog, and admins
- add dynamic monetization and sponsored-placement control under master-admin authority
- add auditability and analytics as first-class admin features

If implemented in this order, the result will be a scalable and governable admin control center rather than a larger version of the current tabbed dashboard.
