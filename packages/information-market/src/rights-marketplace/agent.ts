import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { RightsMarketplaceFailure } from './types.ts';
import type { InformationRightsMarketplace } from './service.ts';
import { projectLicenses, projectPermissions, projectRights } from './projections.ts';

/**
 * Agent contract for the Information Rights Marketplace.
 * The agent may explain and help initiate a consent change.
 * It may not accept material terms, change compensation policy,
 * or fabricate earnings.
 */
export class InformationRightsMarketplaceAgentSurface {
  private readonly market: InformationRightsMarketplace;

  constructor(market: InformationRightsMarketplace) {
    this.market = market;
  }

  explainRights(rightsHolder: string) {
    return ok({
      ...projectRights(this.market, rightsHolder),
      explanation: 'These are usage rights, not a sale of personal data. Ownership is not transferred.',
    });
  }

  showActivePermissions(rightsHolder: string) {
    return ok(projectPermissions(this.market, rightsHolder));
  }

  showApprovedEarnings(rightsHolder: string) {
    const earnings = this.market.earningsFor(rightsHolder);
    return ok({
      ...earnings,
      fabricated: false,
      guaranteed: false,
    });
  }

  explainLicense(rightsHolder: string, licenseId: string) {
    const license = this.market.licensesForHolder(rightsHolder).find((row) => row.licenseId === licenseId);
    if (!license) {
      return err({ code: 'LICENSE_UNKNOWN', message: 'license not found for this subject' });
    }
    return ok({
      ...projectLicenses(this.market, rightsHolder),
      licenseId: license.licenseId,
      purpose: license.purpose,
      explanation: `This license is purpose-scoped to ${license.purpose} and does not authorize other uses.`,
    });
  }

  initiateConsentChange(): Result<
    { readonly proposalOnly: true; readonly executesTerms: false },
    RightsMarketplaceFailure
  > {
    return ok({ proposalOnly: true, executesTerms: false });
  }

  acceptMaterialTerms(): Result<never, RightsMarketplaceFailure> {
    return err({
      code: 'AGENT_CANNOT_ACCEPT_TERMS',
      message: 'agent cannot accept material licensing terms without explicit human approval',
    });
  }

  changeCompensationPolicy(): Result<never, RightsMarketplaceFailure> {
    return err({
      code: 'AGENT_CANNOT_CHANGE_POLICY',
      message: 'agent cannot change compensation policy',
    });
  }

  fabricateEarnings(): Result<never, RightsMarketplaceFailure> {
    return err({
      code: 'AGENT_CANNOT_FABRICATE_EARNINGS',
      message: 'agent cannot fabricate earnings',
    });
  }
}
