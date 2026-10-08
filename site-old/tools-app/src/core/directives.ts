export const DIRECTIVES = {
  version: '1.0.0',
  toolContractVersion: '1.0.0',
  policy: 'compatible' as const,
  description:
    'Canonical directives for the DOME Creative Tools universe. Future tools MUST register via registerTool() and honor this contract so older projects keep rendering.',
}
