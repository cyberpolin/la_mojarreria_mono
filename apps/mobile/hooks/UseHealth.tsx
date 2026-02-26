import { gql } from "@apollo/client";
import { useCallback, useEffect, useState } from "react";
import { client } from "../apollo/client";

export type HealthResponse = {
  ok: boolean;
  status: string;
  timestamp: string;
  service: string;
  version: string;
  uptimeSeconds: number;
  checks: unknown;
};

const HEALTH_QUERY = gql`
  query Health {
    __typename
  }
`;

export const useHealth = (enabled: boolean = true) => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.query({
        query: HEALTH_QUERY,
        fetchPolicy: "network-only",
      });
      if (result.data?.__typename) {
        setData({
          ok: true,
          status: "ok",
          timestamp: new Date().toISOString(),
          service: "graphql",
          version: "unknown",
          uptimeSeconds: 0,
          checks: { graphql: "reachable" },
        });
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run();
  }, [enabled, run]);

  return { data, loading, error, run };
};
