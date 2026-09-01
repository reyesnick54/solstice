/**
 * Approved live HTTP endpoints for Wave 6 opportunity providers.
 */

import { defaultOpportunityUserAgent } from './client.ts';

export const LIVE_OPPORTUNITY_ENDPOINTS = Object.freeze({
  arbeitnow: Object.freeze({
    providerId: 'arbeitnow',
    baseUrl: 'https://www.arbeitnow.com',
    path: '/api/job-board-api',
    userAgent: defaultOpportunityUserAgent(),
  }),
  remoteok: Object.freeze({
    providerId: 'remoteok',
    baseUrl: 'https://remoteok.com',
    path: '/api',
    userAgent: defaultOpportunityUserAgent(),
  }),
  remotive: Object.freeze({
    providerId: 'remotive',
    baseUrl: 'https://remotive.com',
    path: '/api/remote-jobs',
    userAgent: defaultOpportunityUserAgent(),
  }),
  jobicy: Object.freeze({
    providerId: 'jobicy',
    baseUrl: 'https://jobicy.com',
    path: '/api/v2/remote-jobs',
    userAgent: defaultOpportunityUserAgent(),
  }),
  himalayas: Object.freeze({
    providerId: 'himalayas',
    baseUrl: 'https://himalayas.app',
    path: '/jobs/api',
    userAgent: defaultOpportunityUserAgent(),
  }),
  hackernews: Object.freeze({
    providerId: 'hackernews',
    baseUrl: 'https://hn.algolia.com',
    path: '/api/v1/search',
    userAgent: defaultOpportunityUserAgent(),
  }),
} as const);

export const LIVE_OPPORTUNITY_JOB_PROVIDER_IDS = Object.freeze([
  'arbeitnow',
  'remoteok',
  'remotive',
  'jobicy',
  'himalayas',
] as const);

export const UNAVAILABLE_OPPORTUNITY_PROVIDER_IDS = Object.freeze([
  'graphql-jobs',
  'ai-dev-jobs',
  'freehire',
  'techrole-index',
  'open-skills',
  'noozra',
  'datacube-ai',
  'artificial-intelligence-jobs',
] as const);

export const DEGRADED_OPPORTUNITY_PROVIDER_IDS = Object.freeze(['bluesky-public'] as const);
