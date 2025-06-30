import { transferAgent } from './transferAgent';
import { greeterAgent } from './greeterAgent';

(greeterAgent.handoffs as any).push(transferAgent);
(transferAgent.handoffs as any).push(greeterAgent);

export const virtualRepresentativeYesScenario = [
    greeterAgent,
    transferAgent,
];

export const virtualRepresentativeYesCompanyName = 'YES';
