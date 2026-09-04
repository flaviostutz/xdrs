#!/usr/bin/env node
/**
 * Load-test data generator for city-traffic XDRS elements.
 *
 * Produces exactly 3000 content files:
 *  1500  decisions  (50%) – ADR/BDR/EDR  (600 ADR · 450 BDR · 450 EDR)
 *   450  research   (15%)
 *   600  skills     (20%) – each file is a SKILL.md
 *   300  articles    (10%)
 *   150  initiatives  (5%)
 *
 * Scope: city-traffic  (trains, buses, cars, bicycles, pedestrians)
 * Domains: infrastructure, systems, monitoring, maintenance, standards, development,
 *          operations, governance, services, finance, platforms, integrations, pipelines, quality
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Output root
// ---------------------------------------------------------------------------
const OUT = path.join(__dirname, '.xdrs', 'city-traffic');

// ---------------------------------------------------------------------------
// Topic banks  (used to pick varied short-titles)
// ---------------------------------------------------------------------------
const TOPICS = {

  // ─── ADR SUBJECTS ────────────────────────────────────────────────────────
  adr_platform: [
    'central-traffic-control-architecture','road-sensor-network-topology',
    'traffic-signal-coordination-protocol','bus-rapid-transit-corridor-design',
    'train-track-circuit-architecture','bicycle-lane-infra-standards',
    'pedestrian-signal-timing-systems','bridge-structural-monitoring',
    'tunnel-emergency-egress-systems','overhead-catenary-power-supply',
    'road-weather-information-systems','variable-message-sign-placement',
    'emergency-vehicle-preemption','intersection-camera-coverage',
    'multi-modal-interchange-design','bus-stop-shelter-standards',
    'train-platform-access-design','parking-guidance-system-architecture',
    'freight-vehicle-route-management','construction-zone-management',
    'school-zone-safety-systems','highway-ramp-metering-design',
    'underground-utility-coordination','street-lighting-control-network',
    'ev-charging-infrastructure','cycle-superhighway-design',
    'pedestrian-plaza-design','logistics-zone-management',
    'heritage-zone-traffic-calming','airport-ground-transport-integration',
    'port-freight-traffic-coordination','smart-road-surface-integration',
    'level-crossing-safety-design','tram-track-embedded-road-design',
    'roadside-unit-deployment','green-corridor-signal-priority',
    'urban-expressway-interchange','water-sensitive-surface-design',
    'automated-incident-detection-roadway','shared-space-intersection-design',
  ],

  adr_application: [
    'central-traffic-management-platform','real-time-passenger-information',
    'automated-fare-collection','fleet-management-system',
    'incident-detection-response-system','signal-optimization-engine',
    'journey-planner-integration','open-data-platform',
    'emergency-operations-center','command-control-infrastructure',
    'video-analytics-platform','environmental-monitoring-system',
    'transport-operations-management','shared-mobility-platform',
    'traveler-information-broadcast','traffic-prediction-model',
    'asset-management-system','work-order-management',
    'driver-assistance-integration','dynamic-lane-management',
    'congestion-charging-backend','permit-management-system',
    'event-traffic-management','night-operations-system',
    'cross-agency-data-exchange','mobility-as-a-service-backend',
    'ml-operations-platform','edge-computing-traffic-sensing',
    'digital-twin-city-model','autonomous-vehicle-integration',
    'multimodal-trip-planning','geospatial-data-management',
    'communications-network-management','data-lake-architecture',
    'api-gateway-design',
  ],

  adr_governance: [
    'traffic-volume-monitoring','vehicle-speed-monitoring',
    'air-quality-monitoring-network','cctv-surveillance-architecture',
    'incident-alert-system','predictive-maintenance-monitoring',
    'passenger-flow-monitoring','train-occupancy-monitoring',
    'bus-reliability-tracking','bicycle-counter-network',
    'pedestrian-flow-sensors','noise-level-monitoring',
    'surface-flooding-detection','network-performance-dashboard',
    'kpi-reporting-system','anomaly-detection-system',
    'real-time-congestion-monitoring','parking-occupancy-monitoring',
    'cross-boundary-traffic-monitoring','signal-fault-monitoring',
    'bridge-load-monitoring','tunnel-air-monitoring',
    'freight-vehicle-tracking','ev-charging-status-monitoring',
    'public-transport-on-time-performance','incident-duration-tracking',
    'carbon-footprint-monitoring','road-surface-condition-monitoring',
    'weather-impact-monitoring','social-media-sentiment-monitoring',
  ],

  adr_operations: [
    'preventive-maintenance-schedule','road-surface-repair-standards',
    'traffic-signal-maintenance-cycle','bridge-inspection-protocol',
    'tunnel-maintenance-standards','vehicle-fleet-maintenance',
    'sensor-calibration-schedule','cctv-equipment-lifecycle',
    'it-systems-patching-policy','spare-parts-inventory-management',
    'contractor-qualification-standards','emergency-repair-prioritization',
    'seasonal-maintenance-planning','post-incident-restoration',
    'data-backup-recovery-procedures','asset-register-management',
    'lifecycle-cost-management','maintenance-workforce-competency',
    'condition-based-maintenance','rapid-response-maintenance-units',
    'underground-cable-maintenance','street-furniture-maintenance',
    'rail-track-geometry-maintenance','catenary-wire-inspection',
    'bus-stop-cleaning-standards',
  ],

  adr_principles: [
    'data-exchange-protocol-standards','cybersecurity-baseline',
    'accessibility-standards','interoperability-requirements',
    'naming-convention-standards','geographic-information-standards',
    'api-design-standards','documentation-standards',
    'privacy-by-design-standard','open-source-usage-policy',
    'vendor-evaluation-criteria','software-version-management',
    'network-communication-standards','signal-timing-standards',
    'emergency-protocol-standards','incident-classification-standards',
    'data-quality-standards','environmental-compliance-standards',
    'safety-certification-requirements','testing-and-acceptance-standards',
    'data-retention-policy','smart-city-integration-standards',
    'public-transport-service-standards','procurement-technical-standards',
    'urban-mobility-reporting-standards','multimodal-data-model-standards',
    'carbon-neutrality-targets','noise-limit-standards',
    'pedestrian-safety-standards','bicycle-facility-standards',
    'autonomous-vehicle-readiness','disaster-recovery-standards',
    'cloud-security-standards','iot-device-security-standards',
    'data-sovereignty-standards',
  ],

  adr_data: [
    'smart-corridor-pilot-program','autonomous-bus-trial-architecture',
    'connected-vehicle-testbed','next-gen-ticketing-development',
    'bike-share-expansion-architecture','ev-bus-fleet-introduction',
    'drone-delivery-corridor-development','hydrogen-vehicle-infrastructure',
    'micro-mobility-integration','smart-parking-pilot',
    'dynamic-road-pricing-development','autonomous-freight-zones',
    'enhanced-pedestrian-systems','new-metro-line-systems-architecture',
    'tram-extension-design','regional-train-integration',
    'high-capacity-bus-corridor','urban-air-mobility-corridor',
    'predictive-signal-control','data-driven-transport-planning',
    'citizen-mobility-app-development','public-transport-accessibility',
    'mobility-innovation-lab','smart-junction-prototype',
    'open-mobility-data-marketplace','collaborative-filtering-routing',
    'real-time-ridesharing-integration','flood-resilient-transport',
    'post-pandemic-mobility-adaptation','zero-emission-zone-systems',
    'night-safe-route-network','elderly-mobility-assistance',
    'transport-demand-management','congestion-free-zone-development',
    'smart-speed-enforcement-development',
  ],

  // ─── BDR SUBJECTS ────────────────────────────────────────────────────────
  bdr_operations: [
    'bus-service-scheduling-policy','train-service-frequency-standards',
    'incident-response-escalation','service-disruption-management',
    'road-closure-permit-process','traffic-enforcement-policy',
    'driver-fatigue-management','vehicle-deployment-strategy',
    'seasonal-service-adjustments','event-day-operations-protocol',
    'overnight-maintenance-window','multi-agency-coordination',
    'emergency-services-priority-policy','freight-time-window-management',
    'on-demand-service-policy','intermodal-transfer-procedures',
    'lost-property-procedures','passenger-assistance-policy',
    'overcrowding-management-policy','fuel-management-policy',
    'fare-evasion-management-policy','service-quality-monitoring',
    'customer-complaint-procedure','on-time-performance-targets',
    'capacity-planning-process','driver-training-requirements',
    'control-room-staffing-policy','signal-fault-response-protocol',
    'adverse-weather-operations','major-incident-coordination',
    'route-deviation-authorization','temporary-stop-management',
    'fleet-allocation-policy','night-service-operations',
    'cross-operator-data-sharing','performance-reporting-policy',
    'service-change-notification','accessibility-complaint-handling',
    'road-works-coordination-policy','passenger-information-accuracy',
  ],

  bdr_governance: [
    'transport-authority-mandate','regulatory-compliance-framework',
    'data-governance-policy','privacy-policy-for-traveler-data',
    'third-party-supplier-governance','risk-management-framework',
    'audit-and-inspection-policy','staff-conduct-code',
    'conflict-of-interest-policy','board-reporting-standards',
    'public-consultation-requirements','planning-permission-policy',
    'environmental-impact-assessment','equality-and-diversity-policy',
    'whistleblowing-procedure','corporate-social-responsibility',
    'sustainability-governance','information-security-policy',
    'business-continuity-governance','change-management-governance',
    'investment-appraisal-process','program-portfolio-governance',
    'procurement-governance-policy','contract-management-standards',
    'performance-management-framework','delegation-of-authority-matrix',
    'financial-control-standards','health-and-safety-governance',
    'technology-governance-committee','open-data-governance',
    'smart-city-partnership-governance','cross-agency-governance-model',
    'research-and-innovation-governance','stakeholder-engagement-policy',
    'media-communications-policy',
  ],

  bdr_product: [
    'passenger-charter-policy','service-level-agreement-standards',
    'accessibility-service-policy','customer-data-management',
    'fare-structure-policy','concessionary-travel-policy',
    'multimodal-season-ticket-policy','complaints-resolution-standards',
    'station-amenity-standards','real-time-info-service-standards',
    'lost-and-found-service','ticket-refund-policy',
    'timetable-publication-standards','wayfinding-standards',
    'public-wifi-policy','cycle-parking-service',
    'park-and-ride-service','taxi-licensing-standards',
    'rideshare-service-policy','school-transport-service',
    'healthcare-transport-service','mobility-voucher-scheme',
    'tourist-transport-package','cargo-last-mile-service',
    'mobility-hub-services','on-demand-microtransit-service',
    'express-service-policy','bus-replacement-service',
    'disruption-compensation-policy','app-service-standards',
    'contactless-payment-policy','loyalty-rewards-scheme',
    'first-last-mile-service','elderly-transport-assistance',
    'airport-shuttle-service-policy','night-bus-service-standards',
    'car-sharing-integration-policy','freight-booking-service',
    'advance-booking-policy','accessibility-information-service',
  ],

  bdr_finance: [
    'capital-investment-prioritization','operating-budget-allocation',
    'cost-recovery-framework','fare-revenue-forecasting',
    'grant-funding-management','public-private-partnership-policy',
    'infrastructure-financing-strategy','subsidy-management-policy',
    'commercial-revenue-strategy','financial-risk-management',
    'treasury-management-policy','procurement-budget-controls',
    'lifecycle-cost-accounting','value-for-money-assessment',
    'revenue-sharing-agreements','insurance-coverage-policy',
    'debt-management-strategy','financial-audit-policy',
    'asset-valuation-standards','depreciation-policy',
    'emergency-funding-reserves','carbon-credit-trading',
    'green-bond-issuance','fare-increase-decision-process',
    'third-party-billing-policy','fuel-price-hedging-policy',
    'payroll-management-standards','contractor-payment-terms',
    'financial-reporting-standards','budget-variance-reporting',
    'cost-benefit-analysis-standards','innovation-fund-management',
    'digital-transformation-budget','maintenance-fund-allocation',
    'contingency-reserve-policy',
  ],

  // ─── EDR SUBJECTS ────────────────────────────────────────────────────────
  edr_platform: [
    'cloud-infrastructure-platform','database-selection-for-traffic-data',
    'message-broker-selection','api-gateway-platform',
    'containerization-strategy','kubernetes-cluster-design',
    'data-warehouse-platform','stream-processing-platform',
    'iot-device-management-platform','cctv-storage-platform',
    'gis-platform-selection','identity-management-platform',
    'observability-platform','incident-management-platform',
    'document-management-platform','communication-platform',
    'scheduling-platform','data-catalog-platform',
    'ml-model-serving-platform','edge-computing-platform',
    'mobile-app-platform','web-portal-platform',
    'reporting-platform','test-automation-platform',
    'secret-management-platform','backup-and-recovery-platform',
    'network-monitoring-platform','vulnerability-management-platform',
    'configuration-management-database','software-license-management',
    'digital-signage-platform','video-management-platform',
    'payment-processing-platform','real-time-analytics-platform',
    'event-streaming-platform','time-series-database',
    'spatial-database','multi-tenant-platform-design',
    'hybrid-cloud-strategy','on-premises-to-cloud-migration',
  ],

  edr_application: [
    'traffic-signal-controller-interface','vehicle-gps-tracking-integration',
    'fare-payment-gateway-integration','national-rail-data-integration',
    'weather-data-integration','mapping-provider-integration',
    'emergency-services-integration','police-systems-integration',
    'road-works-register-integration','permit-management-integration',
    'public-alert-system-integration','social-media-monitoring-integration',
    'third-party-mobility-integration','smart-parking-system-integration',
    'ev-charge-network-integration','bike-share-backend-integration',
    'open311-integration','national-transport-data-integration',
    'cctv-analytics-integration','environmental-sensor-integration',
    'noise-monitoring-integration','asset-register-integration',
    'crm-integration','hr-system-integration',
    'finance-system-integration','procurement-system-integration',
    'gis-mapping-integration','gtfs-feed-integration',
    'netex-data-exchange','siri-protocol-integration',
    'ocpi-ev-roaming-integration','gbfs-bike-share-integration',
    'tomp-api-integration','datex2-integration',
    'opengis-integration','google-transit-integration',
    'apple-maps-transit-integration','waze-traffic-integration',
  ],

  edr_data: [
    'ci-cd-pipeline-for-traffic-systems','traffic-data-ingestion-pipeline',
    'vehicle-telemetry-pipeline','cctv-video-processing-pipeline',
    'incident-report-automation','fare-data-reconciliation-pipeline',
    'gtfs-rt-feed-pipeline','etl-for-historical-analytics',
    'ml-training-pipeline','model-deployment-pipeline',
    'alert-routing-pipeline','kpi-calculation-pipeline',
    'report-generation-automation','data-quality-pipeline',
    'event-driven-pipeline-architecture','saga-pattern-for-service-operations',
    'dead-letter-queue-handling','change-data-capture-pipeline',
    'database-migration-pipeline','infrastructure-as-code-pipeline',
    'security-scanning-pipeline','release-management-pipeline',
    'config-drift-detection-pipeline','data-archival-pipeline',
    'log-aggregation-pipeline','trace-correlation-pipeline',
    'cost-monitoring-pipeline','capacity-planning-pipeline',
    'demand-forecasting-pipeline','road-condition-data-pipeline',
    'noise-data-ingestion-pipeline','environmental-data-pipeline',
    'api-rate-limiting-pipeline','real-time-geofence-processing',
    'anomaly-scoring-pipeline','cross-agency-data-sync-pipeline',
    'backup-verification-pipeline',
  ],

  edr_governance: [
    'unit-testing-standards','integration-testing-strategy',
    'end-to-end-testing-framework','performance-testing-standards',
    'security-testing-requirements','load-testing-methodology',
    'chaos-engineering-standards','api-contract-testing',
    'data-quality-validation','test-data-management',
    'shift-left-testing-policy','static-code-analysis',
    'code-review-standards','dependency-vulnerability-management',
    'test-coverage-requirements','regression-testing-policy',
    'test-environment-management','accessibility-testing-standards',
    'mobile-app-testing-strategy','embedded-system-testing',
    'iot-device-testing','simulation-testing-for-traffic',
    'pen-testing-standards','disaster-recovery-testing',
    'canary-release-strategy','blue-green-deployment-testing',
    'observability-testing','documentation-testing',
    'acceptance-criteria-standards','defect-management-process',
    'release-readiness-checklist','production-monitoring-standards',
    'slo-sli-definition-standards','error-budget-management',
    'post-mortem-process',
  ],
};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------
function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function pad(n) {
  return String(n).padStart(3, '0');
}

function titleCase(slug) {
  return slug.replace(/-/g, ' ')
             .replace(/\b\w/g, c => c.toUpperCase());
}

function topic(bank, idx) {
  const list = TOPICS[bank];
  return list[idx % list.length];
}

// ---------------------------------------------------------------------------
// Content generators
// ---------------------------------------------------------------------------
function genDecision(scope, typeShort, subject, num, slug) {
  const typeNames = { adr: 'ADR', bdr: 'BDR', edr: 'EDR' };
  const typeName  = typeNames[typeShort];
  const id        = `city-traffic-${typeShort}-policy-${pad(num)}`;
  const name      = `${id}-${slug}`;
  const title     = titleCase(slug);
  const subjectTitle = titleCase(subject);

  const contextByType = {
    adr: `The city traffic management authority operates infrastructure and systems for trains, buses, cars, bicycles, and pedestrians. As the authority grows, ${subjectTitle} decisions must be made consistently and transparently to ensure safety, efficiency, and sustainability.`,
    bdr: `As a public-sector transport operator, business policies governing ${subjectTitle} must be clearly defined to ensure compliance, service quality, and stakeholder confidence across all transport modes and operational units.`,
    edr: `Engineering teams building and operating city traffic systems require clear technical decisions on ${subjectTitle} to ensure systems are reliable, maintainable, secure, and interoperable across the authority's technology estate.`,
  };

  const decisionByType = {
    adr: `**Adopt a standardised, city-wide approach to ${title}**\n\nA unified approach ensures all ${subject} activities across trains, buses, road vehicles, bicycles, and pedestrian infrastructure are consistent, safe, and measurable.`,
    bdr: `**Establish an organisation-wide policy for ${title}**\n\nA documented policy ensures operational teams, partners, and regulators share a common understanding of the authority's position on ${title.toLowerCase()}.`,
    edr: `**Select and implement ${title} as the engineering standard**\n\nEngineering teams MUST follow this decision when working on ${subject}-related components to ensure consistency, reduce technical debt, and support long-term operability.`,
  };

  const implByType = {
    adr: [
      `- All ${subject} initiatives MUST be evaluated against this architecture before procurement or implementation begins.`,
      `- The authority's ${subjectTitle} reference design is maintained in the central architecture repository and reviewed annually.`,
      `- Cross-modal impacts (trains, buses, bicycles, pedestrians, road vehicles) MUST be assessed before any change to ${subject} components.`,
      `- Vendors and contractors operating in ${subject} domains MUST demonstrate compliance with this decision during onboarding.`,
      `- Deviations MUST be approved by the Architecture Review Board and documented as a superseding ADR.`,
    `- Refer to the [city-traffic ADRs index](../index.md) for the full list of applicable decisions in this area.`,
    ],
    bdr: [
      `- This policy applies to all operational units, partner agencies, and contracted service providers.`,
      `- Compliance with this policy is mandatory. Non-compliance MUST be escalated to the relevant governance body.`,
      `- The policy owner is responsible for reviewing and updating this document at least annually or following any significant regulatory change.`,
      `- Exceptions to this policy MUST be formally requested, documented, and approved by the appropriate authority as defined in the delegation matrix.`,
      `- Performance against this policy MUST be reported quarterly to the relevant oversight committee.`,
    ],
    edr: [
      `- All new services and components in the ${subject} domain MUST comply with this decision.`,
      `- Existing systems SHOULD be migrated to comply within the timeline defined in the associated plan.`,
      `- Code reviews MUST verify compliance with this decision before merging to main branches.`,
      `- The engineering team lead is responsible for communicating this decision to all team members and contractors.`,
      `- Tooling deviations require an EDR superseding this one, approved by the Engineering Standards Committee.`,
    ],
  };

  const lines = [
    `---`,
    `name: ${name}`,
    `description: Defines the ${title.toLowerCase()} decision for the city traffic management authority. Use when designing, implementing, or reviewing ${subject} components.`,
    `apply-to: City traffic management authority systems and operations`,
    `valid-from: 2024-01-01`,
    `---`,
    ``,
    `# ${id}: ${title}`,
    ``,
    `## Context and Problem Statement`,
    ``,
    contextByType[typeShort],
    ``,
    `How should the authority approach ${title.toLowerCase()} to ensure consistency and quality across all transport modes?`,
    ``,
    `## Decision Outcome`,
    ``,
    decisionByType[typeShort],
    ``,
    `### Details`,
    ``,
    ...implByType[typeShort],
    ``,
    `## References`,
    ``,
    `- [city-traffic ${typeShort.toUpperCase()}s index](../index.md)`,
    `- [_core-adr-001](../../../_core/adrs/principles/003-xdrs-standards.md)`,
  ];

  return lines.join('\n');
}

function genResearch(scope, typeShort, subject, num, slug) {
  const id    = `city-traffic-${typeShort}-research-${pad(num)}`;
  const title = titleCase(slug);
  const subjectTitle = titleCase(subject);

  return [
    `# city-traffic-${typeShort}-research-${pad(num)}: ${title}`,
    ``,
    `## Abstract`,
    ``,
    `This research investigates ${title.toLowerCase()} within the context of the city traffic management authority. The study evaluates current practices, compares available approaches, and produces evidence-based recommendations to inform the related architectural or engineering decision. Key findings indicate that a structured, standards-aligned approach delivers the highest long-term value.`,
    ``,
    `## Introduction`,
    ``,
    `The authority manages a complex multi-modal transport network covering trains, buses, road vehicles, bicycles, and pedestrians. Decision-making in the ${subjectTitle} domain must be grounded in evidence rather than assumption.`,
    ``,
    `**Context:** City transport networks generate large volumes of operational data and require decisions that balance safety, cost, sustainability, and user experience.`,
    ``,
    `**Constraints:**`,
    `- Regulatory compliance with national transport standards`,
    `- Budget cycles and capital allocation processes`,
    `- Legacy system interoperability requirements`,
    `- Data sovereignty and privacy obligations`,
    ``,
    `**Known gaps:** Prior to this research, no authoritative comparison of options for ${title.toLowerCase()} existed within the authority's documentation.`,
    ``,
    `Question: What is the optimal approach to ${title.toLowerCase()} for the authority's ${subject} domain?`,
    ``,
    `## Methods`,
    ``,
    `The study was conducted using:`,
    ``,
    `1. **Literature review** – Industry standards, peer city case studies, and vendor documentation were reviewed.`,
    `2. **Expert interviews** – Structured interviews with 6 domain specialists across infrastructure, operations, and IT.`,
    `3. **Proof-of-concept** – A limited PoC was run in the authority's test environment over 4 weeks.`,
    `4. **Cost modelling** – Three-year TCO models were built for the top two candidate approaches.`,
    ``,
    `Data sources: UITP benchmarking reports, ITF transport statistics, peer city technical documentation, internal system logs.`,
    ``,
    `## Results`,
    ``,
    `| Criterion | Option A | Option B | Option C |`,
    `|-----------|----------|----------|----------|`,
    `| Implementation cost | Medium | High | Low |`,
    `| Operational complexity | Low | Medium | High |`,
    `| Vendor lock-in risk | Low | High | Low |`,
    `| Standards compliance | Full | Partial | Full |`,
    `| Scalability | High | High | Medium |`,
    ``,
    `Option A demonstrated the best overall profile across all criteria. The PoC confirmed feasibility within the authority's existing technical estate.`,
    ``,
    `## Discussion`,
    ``,
    `Option A aligns with both the authority's technology strategy and international standards. The primary trade-off is the medium upfront cost, which is offset by lower long-term operational complexity.`,
    ``,
    `Option B offers higher scalability but introduces significant vendor lock-in, which is inconsistent with the authority's open-standards policy.`,
    ``,
    `Option C's lower cost comes with higher operational complexity, which increases maintenance burden for teams already under resource pressure.`,
    ``,
    `## Conclusion`,
    ``,
    `Option A is recommended. It balances cost, operational simplicity, and standards compliance. The authority should proceed with Option A as the basis for the related policy. Ongoing evaluation against emerging options is recommended at two-year intervals.`,
    ``,
    `## References`,
    ``,
    `- UITP Global Transport Benchmarking Report`,
    `- ITF Transport Outlook`,
    `- Peer city case study: Helsinki, Singapore, Amsterdam`,
    `- Internal PoC report (authority internal document)`,
  ].join('\n');
}

function genSkill(scope, typeShort, subject, num, slug) {
  const title = titleCase(slug);
  const subjectTitle = titleCase(subject);

  return [
    `---`,
    `name: ${pad(num)}-${slug}`,
    `description: Step-by-step skill for performing ${title.toLowerCase()} within the city traffic management authority's ${subjectTitle} domain. Follow these steps when executing this procedure for trains, buses, road vehicles, bicycles, or pedestrian systems.`,
    `---`,
    ``,
    `# ${title}`,
    ``,
    `## Overview`,
    ``,
    `This skill guides operators and engineers through the ${title.toLowerCase()} procedure. It covers preparation, execution, validation, and escalation steps to ensure safe, compliant, and consistent outcomes.`,
    ``,
    `## Instructions`,
    ``,
    `**Prerequisites:**`,
    ``,
    `- Access to the authority's operations management system`,
    `- Completion of the relevant ${subjectTitle} training module`,
    `- Approval from the shift supervisor or engineering lead`,
    `- All required tools and resources available and checked`,
    ``,
    `### Phase 1: Prepare`,
    ``,
    `1. Review the applicable policies and any recent updates posted to the ${subject} index.`,
    `2. Confirm that all prerequisite conditions are met and documented in the shift log.`,
    `3. Notify all affected teams and stakeholders of the planned activity at least 30 minutes in advance.`,
    `4. Verify that test and monitoring systems are active and capturing baseline data.`,
    ``,
    `### Phase 2: Execute`,
    ``,
    `5. Follow the authority's standard operating procedure for ${title.toLowerCase()}, referencing the current approved version only.`,
    `6. Record all actions, timestamps, and observations in the operations log in real time.`,
    `7. If a deviation from the expected state is observed, pause and follow the escalation path defined in the related incident response decision.`,
    `8. After each major step, confirm with a second operator or automated check that the expected outcome has been achieved.`,
    ``,
    `### Phase 3: Validate`,
    ``,
    `9. Run the applicable post-execution checks defined in the ${subject} quality standards.`,
    `10. Confirm that all monitoring dashboards reflect the expected state.`,
    `11. Document the outcome in the operations log and update the asset register if applicable.`,
    ``,
    `### Phase 4: Close`,
    ``,
    `12. Notify all stakeholders that the activity is complete and confirm the system is in service.`,
    `13. Submit any required reports or compliance records within the defined window.`,
    `14. If any defects were identified, raise a formal defect report and assign to the appropriate team.`,
    ``,
    `## Validation`,
    ``,
    `- All log entries completed and timestamped`,
    `- Post-execution checks passed with no outstanding issues`,
    `- Stakeholder notifications sent and acknowledged`,
    `- Compliance records filed if required`,
    ``,
    `## Escalation`,
    ``,
    `If any step cannot be completed as described, escalate immediately to the ${subjectTitle} team lead and follow the major incident coordination procedure.`,
  ].join('\n');
}

function genArticle(scope, typeShort, subject, num, slug) {
  const title = titleCase(slug);
  const subjectTitle = titleCase(subject);
  const typeLabel = { adr: 'Architecture', bdr: 'Business', edr: 'Engineering' }[typeShort];

  return [
    `# city-traffic-${typeShort}-article-${pad(num)}: ${title}`,
    ``,
    `## Overview`,
    ``,
    `Synthetic overview of key decisions, research, and skills related to ${title.toLowerCase()} within the city traffic management authority's ${subjectTitle} domain.`,
    ``,
    `## Content`,
    ``,
    `${title} is a critical aspect of the authority's ${typeLabel.toLowerCase()} approach to managing a multi-modal transport network. Poor decisions in this area affect safety, service quality, cost efficiency, and regulatory compliance across trains, buses, road vehicles, bicycles, and pedestrian infrastructure.`,
    ``,
    `The following policies govern ${title.toLowerCase()}:`,
    ``,
    `- See the [${typeShort.toUpperCase()}s index](../../index.md) for all applicable ${typeShort.toUpperCase()}s in this subject area.`,
    ``,
    `The authority's approach to ${title.toLowerCase()} is grounded in three principles:`,
    ``,
    `1. **Safety first** – No operational or commercial objective overrides safety requirements.`,
    `2. **Standards compliance** – All components MUST comply with national and international standards.`,
    `3. **Interoperability** – Solutions MUST integrate with existing authority systems and external partner platforms.`,
    ``,
    `| Related area | Interaction |`,
    `|---|---|`,
    `| Platform | Physical dependencies and co-location requirements |`,
    `| Application | Data flows and control interfaces |`,
    `| Controls | Performance tracking and alerting |`,
    `| Operations | Lifecycle and upkeep obligations |`,
    ``,
    `## References`,
    ``,
    `- [${typeShort.toUpperCase()}s policy index](../../index.md)`,
    `- [_core article standards](../../../../_core/adrs/principles/004-article-standards.md)`,
  ].join('\n');
}

function genInitiative(scope, typeShort, subject, num, slug) {
  const title = titleCase(slug);
  const subjectTitle = titleCase(subject);
  // Use a future date ~18 months out from 2026-05-05
  const endDate = '2027-11-30';

  return [
    `# city-traffic-${typeShort}-initiative-${pad(num)}: ${title}`,
    ``,
    `## Executive Summary`,
    ``,
    `- Problem: The authority lacks a consistent approach to ${title.toLowerCase()} in the ${subjectTitle} domain.`,
    `- Solution: Implement the ${title} standard with tooling, training, and verification across all affected transport modes.`,
    `- End date: ${endDate}`,
    `- Key milestones: Decision approval, training delivery, tooling deployment, compliance audit, full rollout.`,
    ``,
    `## Context and Problem Statement`,
    ``,
    `The authority currently lacks a consistent, documented approach to ${title.toLowerCase()} in the ${subjectTitle} domain. This creates operational risk, inconsistency across teams, and gaps in compliance evidence.`,
    ``,
    `**Impact if unresolved:**`,
    `- Increased risk of operational incidents related to ${title.toLowerCase()}`,
    `- Audit findings and potential regulatory penalties`,
    `- Duplication of effort across teams working on the same problem independently`,
    ``,
    `## Proposed Solution`,
    ``,
    `Implement the ${title} standard as defined in the related policy, including tooling, training, and verification steps across all affected transport modes.`,
    ``,
    `Expected end date: ${endDate}`,
    ``,
    `**Scope:**`,
    `- Trains, buses, road vehicles, bicycles, and pedestrian systems as applicable`,
    `- All operational teams in the ${subjectTitle} domain`,
    `- Partner agencies that interface with the authority in this area`,
    ``,
    `## Milestones`,
    ``,
    `| # | Milestone | Owner | Target Date |`,
    `|---|-----------|-------|-------------|`,
    `| 1 | Policy approved and published | ${subjectTitle} Lead | 2026-07-01 |`,
    `| 2 | Training materials developed and delivered | Training Team | 2026-09-01 |`,
    `| 3 | Tooling and templates deployed to all teams | Engineering Team | 2026-11-01 |`,
    `| 4 | First compliance audit completed | Governance Team | 2027-02-01 |`,
    `| 5 | Full rollout completed and initiative closed | Programme Manager | ${endDate} |`,
    ``,
    `## Deliverables`,
    ``,
    `- Updated policies for ${subjectTitle}`,
    `- Training materials and delivery records`,
    `- Tooling deployment evidence`,
    `- Compliance audit report`,
    ``,
    `## References`,
    ``,
    `- Related policies in [${typeShort.toUpperCase()}s index](../../index.md)`,
    `- [Initiative standards](../../../../_core/adrs/principles/005-initiative-standards.md)`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// File plan
// ---------------------------------------------------------------------------
//
// Each entry: { type, subject, decisions, research, skills, articles, initiatives }
//
const PLAN = [
  // ADRs – 600 decisions · 180 research · 240 skills · 120 articles · 60 initiatives
  { type: 'adrs', typeShort: 'adr', subject: 'platform',    decisions: 102, research: 30, skills: 42, articles: 21, initiatives:  9 },
  { type: 'adrs', typeShort: 'adr', subject: 'application', decisions: 102, research: 30, skills: 42, articles: 21, initiatives: 12 },
  { type: 'adrs', typeShort: 'adr', subject: 'governance',   decisions:  99, research: 30, skills: 39, articles: 21, initiatives: 12 },
  { type: 'adrs', typeShort: 'adr', subject: 'operations',  decisions:  99, research: 30, skills: 39, articles: 18, initiatives:  9 },
  { type: 'adrs', typeShort: 'adr', subject: 'principles',  decisions:  99, research: 30, skills: 39, articles: 21, initiatives:  9 },
  { type: 'adrs', typeShort: 'adr', subject: 'data',        decisions:  99, research: 30, skills: 39, articles: 18, initiatives:  9 },
  // BDRs – 450 decisions · 150 research · 195 skills · 105 articles · 45 initiatives
  { type: 'bdrs', typeShort: 'bdr', subject: 'operations',  decisions: 120, research: 39, skills: 51, articles: 27, initiatives: 12 },
  { type: 'bdrs', typeShort: 'bdr', subject: 'governance',  decisions: 108, research: 36, skills: 48, articles: 27, initiatives: 12 },
  { type: 'bdrs', typeShort: 'bdr', subject: 'product',     decisions: 117, research: 39, skills: 51, articles: 27, initiatives: 12 },
  { type: 'bdrs', typeShort: 'bdr', subject: 'finance',     decisions: 105, research: 36, skills: 45, articles: 24, initiatives:  9 },
  // EDRs – 450 decisions · 120 research · 165 skills · 75 articles · 45 initiatives
  { type: 'edrs', typeShort: 'edr', subject: 'platform',    decisions: 117, research: 30, skills: 42, articles: 21, initiatives: 12 },
  { type: 'edrs', typeShort: 'edr', subject: 'application',  decisions: 114, research: 30, skills: 42, articles: 18, initiatives: 12 },
  { type: 'edrs', typeShort: 'edr', subject: 'data',         decisions: 111, research: 30, skills: 42, articles: 18, initiatives: 12 },
  { type: 'edrs', typeShort: 'edr', subject: 'governance',   decisions: 108, research: 30, skills: 39, articles: 18, initiatives:  9 },
];

// Verify plan totals
const totals = PLAN.reduce(
  (acc, r) => ({
    decisions: acc.decisions + r.decisions,
    research:  acc.research  + r.research,
    skills:    acc.skills    + r.skills,
    articles:  acc.articles  + r.articles,
    initiatives: acc.initiatives + r.initiatives,
  }),
  { decisions: 0, research: 0, skills: 0, articles: 0, initiatives: 0 }
);

const total = Object.values(totals).reduce((s, v) => s + v, 0);
console.log('File plan totals:', totals, '=> total:', total);
if (total !== 3000) {
  console.error(`ERROR: expected 3000 content files but plan produces ${total}. Fix the PLAN array.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Generate all files
// ---------------------------------------------------------------------------
let generated = 0;

// Subject-block-aware numbering per _core-adr-policy-017-policy-numbering-ranges
const SUBJECT_BLOCK_STARTS = {
  principles: 1, application: 101, data: 201, platform: 301,
  operations: 401, governance: 501, product: 601, finance: 701,
};
const BLOCK_SIZE = 100;
const subjectDecisionCounters = {};
const overflowCounters = { adrs: 900, bdrs: 900, edrs: 900 };

function nextDecisionNumber(type, subject) {
  const key = `${type}-${subject}`;
  if (!subjectDecisionCounters[key]) subjectDecisionCounters[key] = 0;
  const idx = subjectDecisionCounters[key]++;
  const blockStart = SUBJECT_BLOCK_STARTS[subject];
  if (blockStart === undefined || idx >= BLOCK_SIZE) return ++overflowCounters[type];
  return blockStart + idx;
}

// ── Subject indexes (not counted toward 1000) ──────────────────────────────
// Collect artifact links per type for the type index
const typeArtifactLinks = {};

for (const row of PLAN) {
  const { type, typeShort, subject, decisions, research, skills, articles, initiatives } = row;
  const topicKey = `${typeShort}_${subject}`;
  const subjectDir = path.join(OUT, type, subject);

  if (!typeArtifactLinks[type]) {
    typeArtifactLinks[type] = { decisions: [], research: [], skills: [], articles: [], initiatives: [] };
  }
  const links = typeArtifactLinks[type];

  // ── Decisions ─────────────────────────────────────────────────────────────
  for (let i = 1; i <= decisions; i++) {
    const globalNum = nextDecisionNumber(type, subject);
    const slug = topic(topicKey, i - 1);
    const fileName = `${pad(globalNum)}-${slug}.md`;
    const filePath = path.join(subjectDir, fileName);
    write(filePath, genDecision('city-traffic', typeShort, subject, globalNum, slug));
    generated++;
    links.decisions.push(`- [city-traffic-${typeShort}-${pad(globalNum)}-${slug}](./${subject}/${fileName})`);
  }

  // ── Research ──────────────────────────────────────────────────────────────
  const researchDir = path.join(subjectDir, 'researches');
  for (let i = 1; i <= research; i++) {
    const slug = topic(topicKey, i - 1);  // reuse topic bank with offset
    const fileName = `${pad(i)}-${slug}.md`;
    write(path.join(researchDir, fileName), genResearch('city-traffic', typeShort, subject, i, slug));
    generated++;
    links.research.push(`- [city-traffic-research-${pad(i)}-${slug}](./${subject}/researches/${fileName})`);
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  const skillsDir = path.join(subjectDir, 'skills');
  for (let i = 1; i <= skills; i++) {
    const slug = topic(topicKey, i - 1);
    const skillDir = path.join(skillsDir, `${pad(i)}-${slug}`);
    write(path.join(skillDir, 'SKILL.md'), genSkill('city-traffic', typeShort, subject, i, slug));
    generated++;
    links.skills.push(`- [${pad(i)}-${slug}](./${subject}/skills/${pad(i)}-${slug}/SKILL.md)`);
  }

  // ── Articles ──────────────────────────────────────────────────────────────
  const articlesDir = path.join(subjectDir, 'articles');
  for (let i = 1; i <= articles; i++) {
    const slug = topic(topicKey, i - 1);
    const fileName = `${pad(i)}-${slug}.md`;
    write(path.join(articlesDir, fileName), genArticle('city-traffic', typeShort, subject, i, slug));
    generated++;
    links.articles.push(`- [city-traffic-article-${pad(i)}-${slug}](./${subject}/articles/${fileName})`);
  }

  // ── Initiatives ───────────────────────────────────────────────────────────
  const initiativesDir = path.join(subjectDir, 'initiatives');
  for (let i = 1; i <= initiatives; i++) {
    const slug = topic(topicKey, i - 1);
    const fileName = `${pad(i)}-${slug}.md`;
    write(path.join(initiativesDir, fileName), genInitiative('city-traffic', typeShort, subject, i, slug));
    generated++;
    links.initiatives.push(`- [city-traffic-initiative-${pad(i)}-${slug}](./${subject}/initiatives/${fileName})`);
  }
}

// ---------------------------------------------------------------------------
// Index files (not counted toward 1000)
// ---------------------------------------------------------------------------

// ── Type indexes ───────────────────────────────────────────────────────────
for (const typeShort of ['adr', 'bdr', 'edr']) {
  const type = typeShort + 's';
  const links = typeArtifactLinks[type] || { decisions: [], research: [], skills: [], articles: [], initiatives: [] };
  const content = [
    `# city-traffic ${typeShort.toUpperCase()}s Index`,
    ``,
    `## Decisions`,
    ``,
    ...links.decisions,
    ``,
    `## Research`,
    ``,
    ...links.research,
    ``,
    `## Skills`,
    ``,
    ...links.skills,
    ``,
    `## Articles`,
    ``,
    ...links.articles,
    ``,
    `## Initiatives`,
    ``,
    ...links.initiatives,
  ].join('\n');
  write(path.join(OUT, type, 'index.md'), content);
}

// ── Root scope index ───────────────────────────────────────────────────────
const rootIndex = [
  `---`,
  `scope-type: standard`,
  `name: city-traffic`,
  `description: Contains all policies for the city traffic management authority, covering a multi-modal transport network including trains, buses, road vehicles, bicycles, and pedestrian infrastructure.`,
  `apply-to: All teams and systems within the city traffic management authority`,
  `valid-from: 2025-01-01`,
  `---`,
  ``,
  `# city-traffic Scope Overview`,
  ``,
  `## Overview`,
  ``,
  `The \`city-traffic\` scope contains all policies for the city traffic management authority. The authority manages a multi-modal transport network covering trains, buses, road vehicles, bicycles, and pedestrian infrastructure.`,
  ``,
  `## Domains`,
  ``,
  `The scope is organised across six core domains: **platform**, **application**, **controls**, **operations**, **principles**, and **integration** for architectural decisions; **operations**, **controls**, **product**, and **finance** for business decisions; and **infra**, **application**, **devops**, and **governance** for engineering decisions.`,
  ``,
  `## Type Indexes`,
  ``,
  `- [ADRs Index](adrs/index.md) – Architectural decisions on platform, application, controls, operations, principles, and integration`,
  `- [BDRs Index](bdrs/index.md) – Business decisions on operations, controls, product, and finance`,
  `- [EDRs Index](edrs/index.md) – Engineering decisions on infra, application, devops, and governance`,
].join('\n');

write(path.join(OUT, 'index.md'), rootIndex);

// ── Root .xdrs index ──────────────────────────────────────────────────────
const xdrsRootIndex = [
  `# XDRS Index`,
  ``,
  `This index points to all type- and scope-specific XDRS indexes. XDRS cover Architectural (ADR), Business (BDR), and Engineering (EDR) decisions. Each scope has its own canonical index that lists all Policies for that scope, organized by subject.`,
  ``,
  `## Scope Indexes`,
  ``,
  `XDRS scopes listed last override the ones listed first`,
  ``,
  `### _core`,
  ``,
  `Core framework scope providing scope-type definitions.`,
  `[View scope _core](_core/index.md)`,
  ``,
  `---`,
  ``,
  `### city-traffic`,
  ``,
  `Decision records for the city traffic management authority.`,
  `[View scope city-traffic](city-traffic/index.md)`,
  ``,
  `---`,
  ``,
  `### _local (reserved)`,
  ``,
  `Read _local scope index at \`_local/index.md\` when it exists.`,
].join('\n');

write(path.join(__dirname, '.xdrs', 'index.md'), xdrsRootIndex);

// ── Minimal _core scope ───────────────────────────────────────────────────
// Required so the linter can resolve the 'standard' scope-type policy.
const CORE_OUT = path.join(__dirname, '.xdrs', '_core');

write(path.join(CORE_OUT, 'index.md'), [
  `---`,
  `scope-type: core`,
  `name: _core`,
  `description: Core framework scope providing scope-type definitions.`,
  `apply-to: All XDRS scopes`,
  `valid-from: 2025-01-01`,
  `---`,
  ``,
  `# _core Scope Overview`,
  ``,
  `[ADRs](adrs/index.md)`,
].join('\n'));

write(path.join(CORE_OUT, 'adrs', 'index.md'), [
  `# _core ADR Index`,
  ``,
  `Core ADRs.`,
  ``,
  `## principles`,
  ``,
  `- [001-core-scope-type](principles/001-core-scope-type.md) - core scope type`,
  `- [002-standard-scope-type](principles/002-standard-scope-type.md) - standard scope type`,
  `- [003-xdrs-standards](principles/003-xdrs-standards.md) - XDRS standards`,
  `- [004-article-standards](principles/004-article-standards.md) - Article standards`,
  `- [005-initiative-standards](principles/005-initiative-standards.md) - Initiative standards`,
].join('\n'));

function coreStub(num, name, title) {
  return [
    `---`,
    `name: _core-adr-policy-${num}-${name}`,
    `description: ${title}.`,
    `apply-to: All XDRS scopes`,
    `valid-from: 2025-01-01`,
    `---`,
    ``,
    `# _core-adr-policy-${num}: ${title}`,
    ``,
    `## Context and Problem Statement`,
    ``,
    `Stub for load-test.`,
    ``,
    `## Decision Outcome`,
    ``,
    `See full definition in the xdrs-core package.`,
  ].join('\n');
}

function coreStubScopeType(num, name, title) {
  return coreStub(num, name, title) + '\n\n### Details\n\n#### 01-stub\n\nStub rule for load-test purposes. All rules MUST follow the xdrs-core package definition.';
}

write(path.join(CORE_OUT, 'adrs', 'principles', '001-core-scope-type.md'), coreStubScopeType('001', 'core-scope-type', 'core scope type'));
write(path.join(CORE_OUT, 'adrs', 'principles', '002-standard-scope-type.md'), coreStubScopeType('002', 'standard-scope-type', 'standard scope type'));
write(path.join(CORE_OUT, 'adrs', 'principles', '003-xdrs-standards.md'), coreStub('003', 'xdrs-standards', 'XDRS standards'));
write(path.join(CORE_OUT, 'adrs', 'principles', '004-article-standards.md'), coreStub('004', 'article-standards', 'Article standards'));
write(path.join(CORE_OUT, 'adrs', 'principles', '005-initiative-standards.md'), coreStub('005', 'initiative-standards', 'Initiative standards'));


// ---------------------------------------------------------------------------
console.log(`\nGenerated ${generated} content files (target: 3000). Distribution: decisions=${totals.decisions}, research=${totals.research}, skills=${totals.skills}, articles=${totals.articles}, initiatives=${totals.initiatives}`);

const counts = fs.readdirSync;
// Quick disk count
const { execSync } = require('child_process');
try {
  const mdCount = execSync(`find "${path.join(__dirname, '.xdrs')}" -name "*.md" | wc -l`, { encoding: 'utf8' }).trim();
  console.log(`Total .md files on disk (including indexes): ${mdCount}`);
} catch (_) { /* skip if find not available */ }
