import type { ResourceLimits, ValidatorNodeConfig } from './types.ts';

export function systemdUnit(name: string, exec: string, limits: ResourceLimits): string {
  return [
    '[Unit]',
    `Description=SunRey ${name}`,
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=notify',
    `ExecStart=${exec}`,
    'Restart=on-failure',
    'RestartSec=5',
    'TimeoutStopSec=30',
    'KillSignal=SIGTERM',
    `LimitNOFILE=${limits.openFiles}`,
    `MemoryMax=${limits.memoryBytes}`,
    `CPUQuota=${Math.ceil(limits.cpuMillis / 10)}%`,
    'ReadWritePaths=/var/lib/sunrey',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    '',
  ].join('\n');
}

export function kubernetesProbe(path: string): Record<string, unknown> {
  return {
    httpGet: { path, port: 'operator' },
    periodSeconds: 5,
    failureThreshold: 3,
  };
}

export function kubernetesManifest(config: ValidatorNodeConfig): Record<string, unknown> {
  return {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: { name: `sunrey-${config.role.toLowerCase()}` },
    spec: {
      replicas: config.role === 'SENTRY' ? 2 : 1,
      template: {
        spec: {
          containers: [
            {
              name: 'node',
              resources: {
                limits: {
                  cpu: `${config.resourceLimits.cpuMillis}m`,
                  memory: `${config.resourceLimits.memoryBytes}`,
                },
              },
              readinessProbe: kubernetesProbe('/ready'),
              livenessProbe: kubernetesProbe('/live'),
              volumeMounts: [{ name: 'data', mountPath: config.dataDirectory }],
            },
          ],
        },
      },
      volumeClaimTemplates: [
        {
          metadata: { name: 'data' },
          spec: {
            accessModes: ['ReadWriteOnce'],
            resources: { requests: { storage: `${config.resourceLimits.diskBytes}` } },
          },
        },
      ],
    },
  };
}

export function gracefulShutdownPreserves(config: ValidatorNodeConfig): readonly string[] {
  return Object.freeze([
    `${config.dataDirectory}/consensus.wal`,
    `${config.dataDirectory}/signer-safety`,
    `${config.dataDirectory}/finalized`,
  ]);
}
