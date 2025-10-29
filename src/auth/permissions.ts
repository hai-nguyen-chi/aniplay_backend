export enum Action {
  View = 1 << 0,
  Create = 1 << 1,
  Update = 1 << 2,
  Delete = 1 << 3,
}

export enum Resource {
  Anime = 'anime',
  Episode = 'episode',
  Rating = 'rating',
  Comment = 'comment',
  User = 'user',
}

export function hasActions(bits: number, required: Action[]): boolean {
  const mask = required.reduce((m, a) => m | a, 0);
  return (bits & mask) === mask;
}

export function hasResourcePermissions(
  userPermissions: Map<string, number> | Record<string, number> | undefined,
  resource: string,
  required: Action[],
  fallbackResource: string = '*',
): boolean {
  if (!userPermissions) return false;
  const get = (key: string): number | undefined =>
    userPermissions instanceof Map ? userPermissions.get(key) : (userPermissions as any)[key];

  const value = get(resource);
  if (typeof value === 'number') return hasActions(value, required);

  const wildcard = get(fallbackResource);
  if (typeof wildcard === 'number') return hasActions(wildcard, required);

  return false;
}


