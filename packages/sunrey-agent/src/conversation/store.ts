import type { ConversationEvent, ConversationalAction, ConversationSession } from './types.ts';

export class InMemoryConversationStore {
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly actions = new Map<string, ConversationalAction>();
  private readonly events: ConversationEvent[] = [];
  private seq = 0;

  getSession(id: string): ConversationSession | undefined {
    return this.sessions.get(id);
  }

  putSession(session: ConversationSession): void {
    this.sessions.set(session.conversationId, session);
  }

  getAction(id: string): ConversationalAction | undefined {
    return this.actions.get(id);
  }

  putAction(action: ConversationalAction): void {
    this.actions.set(action.actionId, action);
  }

  listActions(subjectId: string): readonly ConversationalAction[] {
    return [...this.actions.values()]
      .filter((item) => item.subjectId === subjectId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  appendEvent(event: Omit<ConversationEvent, 'seq'>): ConversationEvent {
    this.seq += 1;
    const stored = Object.freeze({ ...event, seq: this.seq });
    this.events.push(stored);
    return stored;
  }

  eventsAfter(conversationId: string, after: number): readonly ConversationEvent[] {
    return this.events.filter((item) => item.conversationId === conversationId && item.seq > after);
  }
}
