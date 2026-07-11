export type LtiToken = {
  user?: string;
  userInfo?: {
    email?: string;
    name?: string;
  };
  platformContext: {
    roles: string[];
    context: { id: string };
    resource: { id: string };
    endpoint?: {
      lineitem?: string;
    };
  };
};
