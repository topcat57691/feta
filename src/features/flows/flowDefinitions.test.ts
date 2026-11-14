import { describe, expect, it } from 'vitest';
import { nextFlowStateId } from './flowDefinitions';

describe('flow state machines', () => {
  it('cycles the dishwasher through a calm deterministic flow', () => {
    expect(nextFlowStateId('dishwasher', 'empty')).toBe('filling');
    expect(nextFlowStateId('dishwasher', 'clean')).toBe('empty');
  });
});
