import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user';

export type PolicyHandler = (
  user: AuthenticatedUser,
  request: Request,
) => boolean;

export const POLICIES_KEY = 'policies';
export const CheckPolicies = (...policies: PolicyHandler[]) =>
  SetMetadata(POLICIES_KEY, policies);
