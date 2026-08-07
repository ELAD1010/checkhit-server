import { IdToken } from "ltijs";

export type LtiToken = IdToken & {
  clientId?: string;
  deploymentId?: string;
  userInfo: IdToken["userInfo"] & {
    email?: string;
    name?: string;
  };
  platformContext: {
    deploymentId?: string;
    roles: string[];
    context: {
      id: string;
      title?: string;
      label?: string;
    };
    resource?: {
      id: string;
      title?: string;
    };
    custom?: Record<string, string>;
    endpoint?: {
      lineitem?: string;
      lineitems?: string;
      scope?: string[];
    };
  };
};
