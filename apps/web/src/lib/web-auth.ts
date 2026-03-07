export const SESSION_COOKIE = "MOJARRERIA_WEB_SESSION";

export const getGraphqlEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";
