import { gql } from "@apollo/client";

export const PIN_LOGIN = gql`
  query ($email: String, $pin: String) {
    auths(where: { pin: { equals: $pin }, email: { equals: $email } }) {
      id
    }
  }
`;

export const LOG_IN = gql`
  mutation LOG_IN($email: String!, $password: String!) {
    authenticateAuthWithPassword(email: $email, password: $password) {
      ... on AuthAuthenticationWithPasswordSuccess {
        sessionToken
        item {
          id
          email
        }
      }
      ... on AuthAuthenticationWithPasswordFailure {
        message
      }
    }
  }
`;

export const IS_LOGGED = gql`
  query IS_LOGGED {
    authenticatedItem {
      ... on Auth {
        id
        email
      }
    }
  }
`;

export const LOG_OUT = gql`
  mutation LOG_OUT {
    endSession
  }
`;
