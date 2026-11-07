import type { ExternalGeoAssetRecord } from '../types.ts';
import { EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA } from '../taxonomy.ts';

const freeze = <T>(value: T): T => Object.freeze(value);

export const DEMO_FACTORY_ASSET: ExternalGeoAssetRecord = freeze({
  schema: EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA,
  geoAssetId: 'geo-asset:us-mi-auto-factory-01',
  canonicalEntityId: 'entity:issuer:ford-motor',
  canonicalProductiveAssetId: 'productive:plant:dearborn-assembly',
  assetType: 'factory',
  displayName: 'Dearborn Assembly (fixture)',
  centroidLat: '42.3223',
  centroidLon: '-83.1763',
  footprintWkt: 'POLYGON((-83.18 42.32,-83.17 42.32,-83.17 42.33,-83.18 42.33,-83.18 42.32))',
  grantsExecutionAuthority: false,
});

export const DEMO_MINE_ASSET: ExternalGeoAssetRecord = freeze({
  schema: EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA,
  geoAssetId: 'geo-asset:cl-copper-mine-01',
  canonicalEntityId: 'entity:issuer:codelco',
  canonicalProductiveAssetId: 'productive:mine:chuquicamata',
  assetType: 'mine',
  displayName: 'Chuquicamata pit (fixture)',
  centroidLat: '-22.2892',
  centroidLon: '-68.9017',
  footprintWkt: null,
  grantsExecutionAuthority: false,
});

export const DEMO_PORT_ASSET: ExternalGeoAssetRecord = freeze({
  schema: EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA,
  geoAssetId: 'geo-asset:us-ca-port-la-01',
  canonicalEntityId: null,
  canonicalProductiveAssetId: 'productive:port:los-angeles',
  assetType: 'port',
  displayName: 'Port of Los Angeles (fixture)',
  centroidLat: '33.7405',
  centroidLon: '-118.2701',
  footprintWkt: null,
  grantsExecutionAuthority: false,
});
