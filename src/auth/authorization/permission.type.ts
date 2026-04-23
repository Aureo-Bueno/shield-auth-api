export const permissions = [
  'users:read:self',
  'users:read:any',
  'invites:manage',
  'audit:read',
] as const;

export type Permission = (typeof permissions)[number];
