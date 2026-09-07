/**
 * ZYRA Fix Strategy Registry
 * Manages explicit registration of versioned fix strategies and exposes the public catalog.
 */

import {
  type FixStrategy,
  type FixStrategyCatalogItem
} from './types.js';
import {
  ImageOptimizationStrategy,
  RenderBlockingStrategy,
  FontOptimizationStrategy,
  UnusedImportStrategy,
  DynamicImportStrategy,
  ResourceOptimizationStrategy
} from './strategies/index.js';

export class FixStrategyRegistry {
  private readonly strategies: Map<string, FixStrategy> = new Map();

  constructor(registerDefaults = true) {
    if (registerDefaults) {
      this.registerDefaultStrategies();
    }
  }

  private registerDefaultStrategies(): void {
    this.register(new ImageOptimizationStrategy());
    this.register(new RenderBlockingStrategy());
    this.register(new FontOptimizationStrategy());
    this.register(new UnusedImportStrategy());
    this.register(new DynamicImportStrategy());
    this.register(new ResourceOptimizationStrategy());
  }

  /**
   * Registers a fix strategy. Throws if a strategy with the same ID is already registered.
   */
  register(strategy: FixStrategy): void {
    if (this.strategies.has(strategy.id)) {
      throw new Error(`Strategy with ID '${strategy.id}' is already registered in FixStrategyRegistry.`);
    }
    this.strategies.set(strategy.id, strategy);
  }

  /**
   * Retrieves a strategy by ID.
   */
  get(id: string): FixStrategy | undefined {
    return this.strategies.get(id);
  }

  /**
   * Retrieves all registered strategies in deterministic registration order.
   */
  getAll(): FixStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Unregisters a strategy by ID.
   */
  unregister(id: string): boolean {
    return this.strategies.delete(id);
  }

  /**
   * Returns a structured, machine-readable strategy catalog.
   */
  getFixStrategyCatalog(): FixStrategyCatalogItem[] {
    return this.getAll().map((s) => ({
      id: s.id,
      version: s.version,
      name: s.name,
      description: s.description,
      riskLevel: s.riskLevel,
      applicableFindings: [...s.applicableFindings],
      applicableCorrelations: [...s.applicableCorrelations],
      preconditions: [...s.preconditions]
    }));
  }
}
