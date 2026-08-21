/**
 * SunRey Phase B API service — Consumer Backend-for-Frontend.
 *
 * Orchestration / presentation only. Not a ledger, Exchange, Agent
 * runtime, compliance engine, investment engine, or payment processor.
 * Mount this handler on the Phase B API runtime. Do not treat this
 * package as a second financial authority.
 */

export * from './consumer/index.ts';
