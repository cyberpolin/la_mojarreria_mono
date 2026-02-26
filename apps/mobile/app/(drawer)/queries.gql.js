import { gql } from "@apollo/client";

export const INITIAL_STOCK = gql`
  mutation ($cash: CashRegisterCreateInput!, $stock: StockCreateInput!) {
    createCashRegister(data: $cash) {
      id
    }
    createStock(data: $stock) {
      id
    }
  }
`;

export const UPDATE_STOCK = gql`
  mutation (
    $cashID: CashRegisterWhereUniqueInput!
    $cash: CashRegisterUpdateInput!
    $stockID: StockWhereUniqueInput!
    $stock: StockUpdateInput!
  ) {
    updateCashRegister(where: $cashID, data: $cash) {
      id
    }
    updateStock(where: $stockID, data: $stock) {
      id
    }
  }
`;

export const GET_STOCKS = gql`
  query {
    stocks {
      id
    }
  }
`;

export const UPDATE_ORDER_STATUS = gql`
  mutation ($id: ID, $status: String!) {
    updateOrder(where: { id: $id }, data: { status: $status }) {
      id
      status
    }
  }
`;
export const UPDATE_ORDERS_STATUS = gql`
  mutation ($data: [OrderUpdateArgs!]!) {
    updateOrders(data: $data) {
      id
    }
  }
`;

export const GET_GROUPED_ORDERS = gql`
  query {
    getGroupOrders {
      id
      client {
        id
        name
        phone
      }
      products {
        id
        name
        price
        timeProcess
      }
      productsWithAmount
      isDelivery
      address
      deliveryCost
      deliveryTime
      notes
      relatedOrders {
        id
        status
      }
      status
      createdAt
    }
  }
`;

export const GET_MATERIALS = gql`
  query {
    rawMaterials {
      id
      name
      quantity
      unit
    }
  }
`;
