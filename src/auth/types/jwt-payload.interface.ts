export interface JwtPayload {
  sub: string;
  email: string;
}

export interface JwtUser {
  sub: string;
  email: string;
  username: string;
  permissions: Map<string, number> | Record<string, number>;
}

