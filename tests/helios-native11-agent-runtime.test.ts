import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assessNativeAgentRuntimeQualification,
  HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED,
} from '../packages/ai-runtime/src/native-agent-runtime/index.ts';
import { assessMeshNativeResearchQualification } from '../packages/agentic-capital-mesh/src/native-research-agent/qualification.ts';
import { assessNativeAgentRuntimeLayerQualification } from '../packages/sunrey-agent/src/native-agent-runtime/qualification.ts';

const NOW = '2026-11-03T09:00:00.000Z';

describe('HELIOS NATIVE11 Seris assimilation qualification', () => {
  it('emits HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED across canonical owners', () => {
    const ai = assessNativeAgentRuntimeQualification(NOW);
    const agent = assessNativeAgentRuntimeLayerQualification(NOW);
    const mesh = assessMeshNativeResearchQualification(NOW);
    assert.equal(ai.marker, HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED);
    assert.equal(agent.marker, HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED);
    assert.equal(mesh.marker, HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED);
  });
});
