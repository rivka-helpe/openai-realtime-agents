import {
  RealtimeAgent,
} from '@openai/agents/realtime';

export const problemSolverAgent = new RealtimeAgent({
  name: 'problemSolver',
  voice: 'sage',
  instructions:
    'Ask the user for a topic, then reply with solution to the problem.',
  handoffs: [],
  tools: [],
  handoffDescription: 'Agent that solves problems',
});

export const greeterAgent = new RealtimeAgent({
  name: 'greeter',
  voice: 'sage',
  instructions:
    "Please greet the user and ask them if they'd like a solution to their problem. If yes, hand off to the 'problemSolver' agent.",
  handoffs: [problemSolverAgent],
  tools: [],
  handoffDescription: 'Agent that greets the user',
});

export const problemSolverScenario = [greeterAgent, problemSolverAgent];
