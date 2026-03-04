import { KeystoneContext } from "@keystone-6/core/types";

const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "prod" ||
  process.env.ENV === "PROD";
const hasValidUserEnv = process.env.EMAIL && process.env.PASSWORD;

// Create the first user if none exist
const createFirstUser = async (context: KeystoneContext) => {
  const suctx = context.sudo();
  const totalUsers = await suctx.db.Auth.count();

  if (!isProd && !totalUsers && hasValidUserEnv) {
    try {
      const user = await suctx.db.Auth.createOne({
        data: {
          email: process.env.EMAIL,
          password: process.env.PASSWORD,
        },
      });
      console.log(
        `\n🚀 Primer usuario creado:\n email: ${user.email} \n password: ${process.env.PASSWORD}\n`,
      );
      return user;
    } catch (error) {
      console.error("Error creating the first user:", error);
      throw error;
    }
  }

  return null;
};

export { createFirstUser };

type UpsertByFindFirstDelegate<
  Where,
  CreateData,
  UpdateData,
  IdType = string,
> = {
  findFirst(args: {
    where: Where;
    select: { id: true };
  }): Promise<{ id: IdType } | null>;
  update(args: { where: { id: IdType }; data: UpdateData }): Promise<unknown>;
  create(args: { data: CreateData }): Promise<unknown>;
};

const upsertByFindFirst = async <
  Where,
  CreateData,
  UpdateData,
  IdType = string,
>(
  delegate: UpsertByFindFirstDelegate<Where, CreateData, UpdateData, IdType>,
  where: Where,
  createData: CreateData,
  updateData: UpdateData,
) => {
  const existing = await delegate.findFirst({ where, select: { id: true } });

  if (existing?.id) {
    return delegate.update({ where: { id: existing.id }, data: updateData });
  }

  return delegate.create({ data: createData });
};

export { upsertByFindFirst };
