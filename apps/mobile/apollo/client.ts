import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import ApolloLinkTimeout from "apollo-link-timeout";
import { APP_CONFIG } from "@/constants/config";
import { reportError } from "@/utils/errorLogger";

const TIMEOUT = APP_CONFIG.timeoutMs;

// If there is no conection within TIMEOUT ms, the request will be aborted, no more hanging!
const apolloTimeout = new ApolloLinkTimeout(TIMEOUT) as unknown as ApolloLink;
const uri = `${APP_CONFIG.apiUrl}/api/graphql`;
console.log("================================");
console.log("Apollo Client URI:", uri);
console.log("APP_CONFIG.apiUrl:", APP_CONFIG.apiUrl);
console.log("================================");

const apolloLink = new HttpLink({
  uri,
});

const csrfPreflightLink = new ApolloLink((operation, forward) => {
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      "apollo-require-preflight": "true",
      "x-apollo-operation-name": operation.operationName || "unknown",
    },
  }));

  return forward(operation);
});

const errorLink = onError(
  ({ graphQLErrors, networkError, operation, response }) => {
    if (graphQLErrors?.length) {
      for (const gqlError of graphQLErrors) {
        reportError(new Error(gqlError.message), {
          tags: {
            scope: "apollo_graphql_error",
            operationName: operation.operationName || "unknown",
            operationType:
              operation.query.definitions?.[0]?.kind === "OperationDefinition"
                ? operation.query.definitions[0].operation
                : "unknown",
          },
          extra: {
            path: gqlError.path,
            extensions: gqlError.extensions,
            variables: operation.variables,
            responseErrors: response?.errors?.map((err) => err.message),
          },
        });
      }
    }

    if (networkError) {
      reportError(networkError, {
        tags: {
          scope: "apollo_network_error",
          operationName: operation.operationName || "unknown",
        },
        extra: {
          variables: operation.variables,
        },
      });
    }
  },
);

const link = ApolloLink.from([
  errorLink,
  csrfPreflightLink,
  apolloTimeout,
  apolloLink,
]);

// Initialize Apollo Client
export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});
