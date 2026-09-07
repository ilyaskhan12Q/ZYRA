/**
 * ZYRA Correlation Rule Registry
 */

import { type CorrelationRule } from './types.js';
import { DEFAULT_CORRELATION_RULES } from './rules/index.js';

export class CorrelationRegistry {
  private rules = new Map<string, CorrelationRule>();

  constructor(initialRules: readonly CorrelationRule[] = DEFAULT_CORRELATION_RULES) {
    for (const rule of initialRules) {
      this.register(rule);
    }
  }

  register(rule: CorrelationRule): void {
    if (!rule || typeof rule.id !== 'string') {
      throw new Error('Invalid correlation rule: Rule must have a valid string ID.');
    }
    if (this.rules.has(rule.id)) {
      throw new Error(`Duplicate correlation rule registration: Rule with ID '${rule.id}' is already registered.`);
    }
    this.rules.set(rule.id, rule);
  }

  get(id: string): CorrelationRule | undefined {
    return this.rules.get(id);
  }

  has(id: string): boolean {
    return this.rules.has(id);
  }

  unregister(id: string): boolean {
    return this.rules.delete(id);
  }

  getAll(): CorrelationRule[] {
    return Array.from(this.rules.values());
  }

  get size(): number {
    return this.rules.size;
  }
}
