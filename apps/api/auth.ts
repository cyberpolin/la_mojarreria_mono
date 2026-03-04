import { createAuth } from "@keystone-6/auth";
import { statelessSessions } from "@keystone-6/core/session";
import { randomBytes } from "crypto";

const sessionSecret =
  process.env.SESSION_SECRET || randomBytes(32).toString("hex");

const { withAuth } = createAuth({
  listKey: "Auth",
  identityField: "email",
  secretField: "password",

  sessionData: `
    id
    email
    user {
      id
      name
      phone
    }
  `,
});

const sessionMaxAge = 60 * 60 * 24 * 30;
const session = statelessSessions({
  maxAge: sessionMaxAge,
  secret: sessionSecret,
});

export { withAuth, session };
