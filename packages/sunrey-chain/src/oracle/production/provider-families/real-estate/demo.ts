export { runRealEstateInfrastructureDataFabricDemo } from '../real-estate-infrastructure-demo.ts';

import { runRealEstateInfrastructureDataFabricDemo } from '../real-estate-infrastructure-demo.ts';

const invokedDirectly = (process.argv[1] ?? '').includes('provider-families/real-estate/demo');
if (invokedDirectly) {
  runRealEstateInfrastructureDataFabricDemo();
}
