import type {
  GrowIntelligenceNarrativeSection,
  GrowIntelligenceSummarizerPort,
  StructuredEveningRecapArtifact,
  StructuredMorningBriefArtifact,
} from './types.ts';
import type { GrowReportType } from './taxonomy.ts';

function formatMoney(money: { readonly minorUnits: string; readonly currency: string }): string {
  const major = Number(money.minorUnits) / 100;
  return `${major.toFixed(2)} ${money.currency}`;
}

export function buildDeterministicMorningNarrative(
  structured: StructuredMorningBriefArtifact,
): readonly GrowIntelligenceNarrativeSection[] {
  const sections: GrowIntelligenceNarrativeSection[] = [
    Object.freeze({
      heading: 'Grow capital',
      body: `Your Grow capital is ${formatMoney(structured.growCapital)} with ${formatMoney(structured.availableCash)} available cash.`,
      factRefs: Object.freeze(['growCapital', 'availableCash']),
    }),
  ];

  if (structured.activePositions.length > 0) {
    const labels = structured.activePositions.map((p) => p.displayName).join(', ');
    sections.push(
      Object.freeze({
        heading: 'Active positions',
        body: `HELIOS is monitoring ${structured.activePositions.length} active position(s): ${labels}.`,
        factRefs: Object.freeze(['activePositions']),
      }),
    );
  } else {
    sections.push(
      Object.freeze({
        heading: 'Active positions',
        body: 'No active positions are open right now.',
        factRefs: Object.freeze(['activePositions']),
      }),
    );
  }

  if (structured.marketRegimes.length > 0) {
    const regimeText = structured.marketRegimes
      .map((r) => `${r.scope} is in a ${r.label} regime (${r.confidenceBand} confidence)`)
      .join('; ');
    sections.push(
      Object.freeze({
        heading: 'Market regimes',
        body: regimeText,
        factRefs: Object.freeze(['marketRegimes']),
      }),
    );
  }

  if (structured.scheduledMarketEvents.length > 0) {
    const events = structured.scheduledMarketEvents.map((e) => e.title).join(', ');
    sections.push(
      Object.freeze({
        heading: 'Scheduled market events',
        body: `Important scheduled events today include: ${events}.`,
        factRefs: Object.freeze(['scheduledMarketEvents']),
      }),
    );
  }

  if (structured.monitoredMarkets.length > 0) {
    const markets = structured.monitoredMarkets.map((m) => m.displayName).join(', ');
    sections.push(
      Object.freeze({
        heading: 'Markets HELIOS is monitoring',
        body: `HELIOS is watching ${markets}.`,
        factRefs: Object.freeze(['monitoredMarkets']),
      }),
    );
  }

  sections.push(
    Object.freeze({
      heading: 'Risk state',
      body: `Current Grow risk state is ${structured.riskState}.`,
      factRefs: Object.freeze(['riskState']),
    }),
  );

  const limitations = [...structured.providerLimitations, ...structured.dataLimitations];
  if (limitations.length > 0) {
    sections.push(
      Object.freeze({
        heading: 'Data and provider limitations',
        body: limitations.map((l) => l.message).join(' '),
        factRefs: Object.freeze(['providerLimitations', 'dataLimitations']),
      }),
    );
  }

  if (structured.strategyStateChanges.length > 0) {
    const changes = structured.strategyStateChanges
      .map((c) => `${c.strategyRef} moved from ${c.priorState} to ${c.nextState}: ${c.reason}`)
      .join(' ');
    sections.push(
      Object.freeze({
        heading: 'Strategy state changes',
        body: changes,
        factRefs: Object.freeze(['strategyStateChanges']),
      }),
    );
  }

  if (structured.executionMode === 'PAPER') {
    sections.push(
      Object.freeze({
        heading: 'Paper mode',
        body: 'This brief reflects paper/simulation activity. Results are not live customer returns.',
        factRefs: Object.freeze(['executionMode']),
      }),
    );
  }

  sections.push(
    Object.freeze({
      heading: 'Important note',
      body: 'This brief summarizes current facts. HELIOS does not guarantee future outcomes.',
      factRefs: Object.freeze(['noGuaranteedOutcomes']),
    }),
  );

  return Object.freeze(sections);
}

export function buildDeterministicEveningNarrative(
  structured: StructuredEveningRecapArtifact,
): readonly GrowIntelligenceNarrativeSection[] {
  const sections: GrowIntelligenceNarrativeSection[] = [
    Object.freeze({
      heading: 'Portfolio summary',
      body: `Your portfolio started the day at ${formatMoney(structured.startingPortfolioValue)} and ended at ${formatMoney(structured.endingPortfolioValue)}.`,
      factRefs: Object.freeze(['startingPortfolioValue', 'endingPortfolioValue']),
    }),
    Object.freeze({
      heading: 'P&L',
      body: `Realized P&L: ${formatMoney(structured.realizedPnl)}. Unrealized P&L: ${formatMoney(structured.unrealizedPnl)}. Fees: ${formatMoney(structured.fees)}.`,
      factRefs: Object.freeze(['realizedPnl', 'unrealizedPnl', 'fees']),
    }),
  ];

  if (BigInt(structured.principalDepositsExcluded.minorUnits) > 0n) {
    sections.push(
      Object.freeze({
        heading: 'Deposits excluded',
        body: `${formatMoney(structured.principalDepositsExcluded)} in deposits were excluded from investment performance.`,
        factRefs: Object.freeze(['principalDepositsExcluded']),
      }),
    );
  }

  const opened = structured.tradesOpened.length;
  const closed = structured.tradesClosed.length;
  sections.push(
    Object.freeze({
      heading: 'Trading activity',
      body:
        opened + closed === 0
          ? 'No trades or paper trades were opened or closed today.'
          : `${opened} trade(s)/paper trade(s) opened and ${closed} closed.`,
      factRefs: Object.freeze(['tradesOpened', 'tradesClosed']),
    }),
  );

  if (structured.opportunitiesEvaluated > 0) {
    let body = `HELIOS evaluated ${structured.opportunitiesEvaluated} opportunit${structured.opportunitiesEvaluated === 1 ? 'y' : 'ies'}.`;
    if (structured.opportunitiesRejected.length > 0) {
      const rejections = structured.opportunitiesRejected
        .map(
          (o) =>
            `HELIOS evaluated ${o.displayName} but did not allocate capital because ${o.rejectionReason.toLowerCase()}.`,
        )
        .join(' ');
      body = `${body} ${rejections}`;
    }
    sections.push(
      Object.freeze({
        heading: 'Opportunities',
        body,
        factRefs: Object.freeze(['opportunitiesEvaluated', 'opportunitiesRejected']),
      }),
    );
  }

  if (structured.riskInterventions.length > 0) {
    sections.push(
      Object.freeze({
        heading: 'Risk interventions',
        body: structured.riskInterventions.map((r) => r.message).join(' '),
        factRefs: Object.freeze(['riskInterventions']),
      }),
    );
  }

  sections.push(
    Object.freeze({
      heading: 'Cash and deployment',
      body: `Available cash: ${formatMoney(structured.availableCash)}. Deployed capital: ${formatMoney(structured.deployedCapital)}. Withdrawable cash: ${formatMoney(structured.withdrawableCash)}.`,
      factRefs: Object.freeze(['availableCash', 'deployedCapital', 'withdrawableCash']),
    }),
  );

  if (BigInt(structured.unsettledCash.minorUnits) > 0n) {
    sections.push(
      Object.freeze({
        heading: 'Unsettled activity',
        body: `${formatMoney(structured.unsettledCash)} remains unsettled and is not yet withdrawable.`,
        factRefs: Object.freeze(['unsettledCash']),
      }),
    );
  }

  if (structured.performanceAttribution.length > 0) {
    const lines = structured.performanceAttribution
      .map((line) => `${line.source}: ${formatMoney(line.amount)} (${line.kind})`)
      .join('; ');
    sections.push(
      Object.freeze({
        heading: 'Performance attribution',
        body: lines,
        factRefs: Object.freeze(['performanceAttribution']),
      }),
    );
  }

  if (structured.executionMode === 'PAPER') {
    sections.push(
      Object.freeze({
        heading: 'Paper mode',
        body: 'This recap reflects paper/simulation activity. Results are not live customer returns.',
        factRefs: Object.freeze(['executionMode']),
      }),
    );
  }

  return Object.freeze(sections);
}

export function buildDeterministicNarrative(
  reportType: GrowReportType,
  structured: StructuredMorningBriefArtifact | StructuredEveningRecapArtifact,
): readonly GrowIntelligenceNarrativeSection[] {
  if (reportType === 'MORNING_BRIEF') {
    return buildDeterministicMorningNarrative(structured as StructuredMorningBriefArtifact);
  }
  return buildDeterministicEveningNarrative(structured as StructuredEveningRecapArtifact);
}

export function summarizeReportSections(
  reportType: GrowReportType,
  structured: StructuredMorningBriefArtifact | StructuredEveningRecapArtifact,
  summarizer: GrowIntelligenceSummarizerPort | undefined,
): {
  readonly sections: readonly GrowIntelligenceNarrativeSection[];
  readonly summarizerMode: 'DETERMINISTIC' | 'AI_ASSISTED';
  readonly summarizerAvailable: boolean;
} {
  const fallback = buildDeterministicNarrative(reportType, structured);
  if (!summarizer?.available) {
    return Object.freeze({
      sections: fallback,
      summarizerMode: 'DETERMINISTIC',
      summarizerAvailable: false,
    });
  }
  const aiSections = summarizer.summarize({
    reportType,
    structured,
    factsHash: structured.factsHash,
  });
  if (Array.isArray(aiSections) && aiSections.length > 0) {
    return Object.freeze({
      sections: Object.freeze(aiSections),
      summarizerMode: 'AI_ASSISTED',
      summarizerAvailable: true,
    });
  }
  return Object.freeze({
    sections: fallback,
    summarizerMode: 'DETERMINISTIC',
    summarizerAvailable: true,
  });
}

export function buildReportSummary(sections: readonly GrowIntelligenceNarrativeSection[]): string {
  if (sections.length === 0) {
    return '';
  }
  return sections.map((section) => section.body).join('\n\n');
}
