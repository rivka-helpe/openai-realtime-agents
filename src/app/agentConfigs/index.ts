import { simpleHandoffScenario } from './simpleHandoff';
import { customerServiceRetailScenario } from './customerServiceRetail';
import { chatSupervisorScenario } from './chatSupervisor';
import { problemSolverScenario } from './problemSolverAgent';
import { virtualRepresentativeYesScenario } from './virtualRepresentativeYes';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
  problemSolver: problemSolverScenario,
  virtualRepresentativeYes: virtualRepresentativeYesScenario,
};

export const defaultAgentSetKey = 'chatSupervisor';
