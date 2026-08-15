import { err, ok, type Result } from '../../domain/src/result.ts';
import { MESH_ISOLATION } from './isolation.ts';
import {
  APPROVED_MESH_TOOLS,
  type ApprovedMeshTool,
  type CapitalContext,
} from './types.ts';

export type ToolFailure = {
  readonly code: 'TOOL_FORBIDDEN' | 'SUBJECT_MISMATCH' | 'UNKNOWN_TOOL';
  readonly message: string;
};

export type ToolResult = {
  readonly tool: ApprovedMeshTool;
  readonly subjectId: string;
  readonly payload: unknown;
  readonly writePath: false;
};

const FORBIDDEN = new Set<string>(MESH_ISOLATION.forbiddenTools);

export function invokeMeshTool(
  context: CapitalContext,
  subjectId: string,
  tool: string,
): Result<ToolResult, ToolFailure> {
  if (FORBIDDEN.has(tool)) {
    return err({
      code: 'TOOL_FORBIDDEN',
      message: `${tool} is not a Mesh tool; the Mesh cannot mutate financial or policy state`,
    });
  }
  if (!(APPROVED_MESH_TOOLS as readonly string[]).includes(tool)) {
    return err({ code: 'UNKNOWN_TOOL', message: `unknown or unapproved tool ${tool}` });
  }
  if (context.subjectId !== subjectId) {
    return err({
      code: 'SUBJECT_MISMATCH',
      message: 'CapitalContext is subject-bound; Customer A cannot retrieve Customer B data',
    });
  }
  const approved = tool as ApprovedMeshTool;
  return ok(
    Object.freeze({
      tool: approved,
      subjectId,
      payload: readTool(context, approved),
      writePath: false,
    }),
  );
}

function readTool(context: CapitalContext, tool: ApprovedMeshTool): unknown {
  switch (tool) {
    case 'getPortfolio':
      return context.portfolio;
    case 'getMarketSnapshot':
      return context.market;
    case 'getRiskSnapshot':
      return { riskBudget: context.riskBudget, snapshotRef: context.riskSnapshotRef };
    case 'getMandate':
      return context.mandate;
    case 'getGrowthPlan':
      return context.growth;
    case 'getEconomicValueSnapshot':
      return context.peve;
    case 'getInstrumentMetadata':
      return context.universe;
    case 'getRdtReadiness':
      return context.rdt;
    default: {
      const _exhaustive: never = tool;
      return _exhaustive;
    }
  }
}
