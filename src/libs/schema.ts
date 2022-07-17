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
  isAdmin: boolean;
  email: string;
  photoString: string;
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

export interface PaymentPlan {
  name: string;
  isFree: boolean;
  price: number;
  nextInstallment: number; // Unix Timestamp (UTC-TZ)
}

export interface ScanReturn {
  inputData: Partial<UserAccess>;
  integrationName: string;
  integrationOrganisationId: string;
  paymentPlan: PaymentPlan;
  paymentPlanPrice: number;
  paymentPlanIsActive: boolean;
  paymentPlanIsTrial: boolean;
  integrationUserId: string;
  integrationUserName: string;
  integrationUserEmail: string;
  integrationUserImage: string;
  integrationUsers: User[];
  integrationWorkspaces: string[];
  integrationUserRole: string;
  blob: any;
}
