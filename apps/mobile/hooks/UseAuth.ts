import { useMutation, useQuery } from "@apollo/client";
import { LOG_IN, IS_LOGGED, LOG_OUT } from "../app/(auth)/queries.gql";

const useAuth = () => {
  const { data, loading: userLoading, refetch } = useQuery(IS_LOGGED);
  const [logOut] = useMutation(LOG_OUT);

  const [logIn, { loading: loginLoading }] = useMutation(LOG_IN);

  const loginWithCredentials = async () => {
    try {
      const { data: loginData } = await logIn({
        variables: { email: "paco@yopmail.com", password: "12345678" },
      });

      if (loginData?.authenticateAuthWithPassword?.sessionToken) {
        await refetch();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Login error:", e);
      return false;
    }
  };
  const handleLogout = async () => {
    try {
      await logOut();
      await refetch();
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  return {
    user: data?.authenticatedItem,
    loading: loginLoading || userLoading,
    loginWithCredentials,
    handleLogout,
  };
};

export default useAuth;
