export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

export interface User {
  id: number;
  role: string;
  email: string;
  googlePhoto: string;
}

export interface Integration {
  name: string;
  domain: string;
  admins: number[];
}

export interface Organisation {
  name: string;
  domain: string;
  admin: number;
  integrations: Integration[];
}

export interface UserAccess {
  user: User;
  organisation: Organisation;
  cookies: Cookie[];
  integration: Integration;
}
