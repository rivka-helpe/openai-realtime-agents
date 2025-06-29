import { yesAgent } from './yesAgent';
import { transferAgent } from './transferAgent';

(yesAgent.handoffs as any).push(transferAgent);
(transferAgent.handoffs as any).push(yesAgent);

export const chatSupervisorScenario = [
  yesAgent,
  transferAgent,
];

export const customerServiceRetailCompanyName = 'yes';
