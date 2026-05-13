import type { DealerServiceCapability } from '../types';

export interface DealerServiceCapabilityOption {
  value: DealerServiceCapability;
  labelKey: string;
  defaultLabel: string;
  descriptionKey: string;
  defaultDescription: string;
}

export const DEALER_SERVICE_CAPABILITY_OPTIONS: DealerServiceCapabilityOption[] = [
  {
    value: 'ev_service',
    labelKey: 'dealerDashboardPage.serviceCapabilities.evService',
    defaultLabel: 'EV service',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.evService',
    defaultDescription: 'General inspection, maintenance, and EV-specific support.',
  },
  {
    value: 'certified_service',
    labelKey: 'dealerDashboardPage.serviceCapabilities.certifiedService',
    defaultLabel: 'Official or certified service',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.certifiedService',
    defaultDescription: 'Manufacturer-authorized, certified, or documented service support.',
  },
  {
    value: 'parts_supply',
    labelKey: 'dealerDashboardPage.serviceCapabilities.partsSupply',
    defaultLabel: 'Parts supply',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.partsSupply',
    defaultDescription: 'Replacement parts, accessories, or service parts availability.',
  },
  {
    value: 'battery_diagnostics',
    labelKey: 'dealerDashboardPage.serviceCapabilities.batteryDiagnostics',
    defaultLabel: 'Battery diagnostics',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.batteryDiagnostics',
    defaultDescription: 'Battery health checks, diagnostics, and high-voltage inspection support.',
  },
  {
    value: 'charging_installation',
    labelKey: 'dealerDashboardPage.serviceCapabilities.chargingInstallation',
    defaultLabel: 'Home or business charging help',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.chargingInstallation',
    defaultDescription: 'Wallbox guidance, installation coordination, or charging setup help.',
  },
  {
    value: 'warranty_support',
    labelKey: 'dealerDashboardPage.serviceCapabilities.warrantySupport',
    defaultLabel: 'Warranty support',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.warrantySupport',
    defaultDescription: 'Warranty handling, claims assistance, or manufacturer warranty support.',
  },
  {
    value: 'trade_in',
    labelKey: 'dealerDashboardPage.serviceCapabilities.tradeIn',
    defaultLabel: 'Trade-in accepted',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.tradeIn',
    defaultDescription: 'Trade-in or vehicle exchange options for customers.',
  },
  {
    value: 'financing',
    labelKey: 'dealerDashboardPage.serviceCapabilities.financing',
    defaultLabel: 'Financing support',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.financing',
    defaultDescription: 'Loan, leasing, or payment-plan assistance.',
  },
  {
    value: 'roadside_assistance',
    labelKey: 'dealerDashboardPage.serviceCapabilities.roadsideAssistance',
    defaultLabel: 'Roadside assistance',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.roadsideAssistance',
    defaultDescription: 'Emergency, towing, or roadside partner support.',
  },
  {
    value: 'other',
    labelKey: 'dealerDashboardPage.serviceCapabilities.other',
    defaultLabel: 'Other EV support',
    descriptionKey: 'dealerDashboardPage.serviceCapabilityDescriptions.other',
    defaultDescription: 'Any other dealership capability customers should know about.',
  },
];
