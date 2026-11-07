#!/usr/bin/env node
/**
 * HELIOS MD10 macro market reference qualification (simulation fixtures).
 */

import { evaluateMd10Qualification, HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED } from '../packages/platform/src/helios/market-data/md10/index.ts';

const result = evaluateMd10Qualification();
console.log(JSON.stringify(result, null, 2));
process.exit(result.marker === HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED ? 0 : 1);
