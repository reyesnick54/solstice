import type {
  PortfolioExposureGraph,
  PortfolioExposureGraphSnapshot,
  PortfolioExposureGraphStorePort,
} from './types.ts';

export class InMemoryHeliosPortfolioExposureGraphStore implements PortfolioExposureGraphStorePort {
  readonly #graphs = new Map<string, PortfolioExposureGraph[]>();

  save(graph: PortfolioExposureGraph): void {
    const rows = this.#graphs.get(graph.portfolioId) ?? [];
    rows.push(graph);
    this.#graphs.set(graph.portfolioId, rows);
  }

  latestForPortfolio(portfolioId: string): PortfolioExposureGraph | undefined {
    const rows = this.#graphs.get(portfolioId);
    return rows?.[rows.length - 1];
  }

  snapshot(): PortfolioExposureGraphSnapshot {
    return Object.freeze({
      graphs: Object.freeze([...this.#graphs.values()].flatMap((rows) => rows)),
    });
  }

  restore(snapshot: PortfolioExposureGraphSnapshot): void {
    this.#graphs.clear();
    for (const graph of snapshot.graphs) {
      const rows = this.#graphs.get(graph.portfolioId) ?? [];
      rows.push(graph);
      this.#graphs.set(graph.portfolioId, rows);
    }
  }
}
