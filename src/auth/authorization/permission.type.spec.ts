import { permissions } from './permission.type';

describe('permission.type', () => {
  it('exports the expected permission catalog', () => {
    expect(permissions).toEqual([
      'users:read:self',
      'users:read:any',
      'invites:manage',
      'audit:read',
    ]);
  });
});
