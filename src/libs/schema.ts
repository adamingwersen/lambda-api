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
  role: string;
  email: string;
  googlePhoto: string;
}

export interface Integration {
  name: string;
  domain: string;
  admins: User[];
}

export interface Organisation {
  domain: string;
  admin: User;
  integrations: Integration[];
}

export interface UserAccess {
  user: User;
  organisation: Organisation;
  cookies: Cookie[];
  integration: Integration;
}
