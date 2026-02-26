import { gql } from "@apollo/client";

export const CREATE_QR_STAFF = gql`
  mutation {
    createQRStaff(data: {}) {
      id
      token
      createdAt
    }
  }
`;
