import { Request } from 'express';
import { JwtUser } from './jwt-payload.interface';

export interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

