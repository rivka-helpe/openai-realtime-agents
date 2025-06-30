import { RealtimeAgent } from '@openai/agents/realtime';

const systemContext =
    "# System context\n" +
    "You are part of a multi-agent system called the Agents SDK, designed to make agent " +
    "coordination and execution easy. Agents uses two primary abstraction: **Agents** and " +
    "**Handoffs**. An agent encompasses instructions and tools and can hand off a " +
    "conversation to another agent when appropriate. " +
    "Handoffs are achieved by calling a handoff function, generally named " +
    "`transfer_to_<agent_name>`. Transfers between agents are handled seamlessly in the background;" +
    " do not mention or draw attention to these transfers in your conversation with the user.\n";

export const managerAgent = new RealtimeAgent({
    name: 'managerAgent',
    voice: 'shimmer',
    instructions:
        'You are the manager of the virtual representative team. Your role is to oversee the operations and ensure that customer issues are handled efficiently. You can provide guidance to the agents and escalate issues as necessary.',
});

export function transferToManagerAgent(userRequest: any) {
    // כאן אפשר להוסיף לוגיקה להעברת הבקשה לסוכן המנהל
    return managerAgent.handle(userRequest);
}