import { Prisma } from "@prisma/client";
import { DEFAULT_FOOTER, type FooterConfig } from "@dialindooh/shared";
import { hashPassword, verifyPassword, type AuthContext } from "@/server/auth";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { clearTvReleaseCache } from "@/server/services/tvRelease";
import { assertStorageUrl } from "@/server/storage/mediaStorage";
import { serializeAccount, serializeCompany, serializeUser } from "@/server/utils/serializers";
import {
  accountAdminUpdateSchema,
  accountCreateSchema,
  accountUpdateSchema,
  companyCreateSchema,
  companyUpdateSchema,
  profileUpdateSchema,
  rssSourceCreateSchema,
  userCreateSchema,
  userUpdateSchema
} from "@/server/validation/schemas";

export const accountService = {
  async getSession(ctx: AuthContext) {
    const [account, accounts] = await Promise.all([
      prisma.account.findUniqueOrThrow({ where: { id: ctx.accountId } }),
      prisma.account.findMany({
        where: { id: { in: ctx.manageableAccountIds } },
        select: { id: true, name: true, kind: true },
        orderBy: { name: "asc" }
      })
    ]);

    return {
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
        avatarUrl: ctx.user.avatarUrl,
        timezone: ctx.user.timezone
      },
      account: serializeAccount(account),
      accounts,
      isSuperadmin: ctx.isSuperadmin,
      isAdmin: ctx.isAdmin,
      restricted: Boolean(ctx.screenIds)
    };
  },

  async updateCurrentAccount(ctx: AuthContext, input: unknown) {
    requireAdmin(ctx);
    const data = accountUpdateSchema.parse(input);

    for (const field of ["logoUrl", "loginImageUrl", "splashUrl"] as const) {
      assertStorageUrl(data[field], field);
    }
    assertStorageUrl(data.footer?.logoUrl, "footer.logoUrl");

    // O APK publicado é instalado automaticamente nas TVs: só o superadmin pode trocá-lo.
    if ((data.apkUrl !== undefined || data.apkVersionCode !== undefined) && !ctx.isSuperadmin) {
      throw new ApiError(403, "forbidden", "Somente o superadmin pode alterar o aplicativo da TV.");
    }

    const account = await prisma.account.update({
      where: { id: ctx.accountId },
      data: {
        ...data,
        footer: data.footer ? (data.footer as Prisma.InputJsonValue) : undefined
      }
    });

    if (data.apkUrl !== undefined || data.apkVersionCode !== undefined) {
      clearTvReleaseCache();
    }

    return serializeAccount(account);
  },

  async getFooter(ctx: AuthContext): Promise<FooterConfig> {
    const account = await prisma.account.findUniqueOrThrow({ where: { id: ctx.accountId }, select: { footer: true } });
    return { ...DEFAULT_FOOTER, ...((account.footer ?? {}) as Partial<FooterConfig>) };
  },

  /* ---------- Clientes (contas filhas) ---------- */

  async listChildAccounts(ctx: AuthContext) {
    await requireReseller(ctx);
    const accounts = await prisma.account.findMany({
      where: ctx.isSuperadmin ? { id: { not: ctx.user.accountId } } : { parentId: ctx.user.accountId },
      include: { _count: { select: { screens: true, users: true } } },
      orderBy: { name: "asc" }
    });

    return accounts.map(serializeAccount);
  },

  async createChildAccount(ctx: AuthContext, input: unknown) {
    await requireReseller(ctx);
    const data = accountCreateSchema.parse(input);

    if (data.kind === "reseller" && !ctx.isSuperadmin) {
      throw new ApiError(403, "forbidden", "Somente o administrador da plataforma cria revendas.");
    }

    await assertEmailFree(data.admin.email);
    const passwordHash = await hashPassword(data.admin.password);

    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.account.create({
        data: {
          name: data.name,
          kind: data.kind,
          parentId: ctx.user.accountId,
          maxScreens: data.maxScreens ?? null,
          maxInstagram: data.maxInstagram ?? 5
        }
      });

      await tx.company.create({ data: { accountId: created.id, name: "Avulso" } });
      await tx.user.create({
        data: {
          accountId: created.id,
          name: data.admin.name,
          email: data.admin.email,
          passwordHash,
          role: "admin"
        }
      });

      return tx.account.findUniqueOrThrow({
        where: { id: created.id },
        include: { _count: { select: { screens: true, users: true } } }
      });
    });

    return serializeAccount(account);
  },

  async updateChildAccount(ctx: AuthContext, id: string, input: unknown) {
    await requireReseller(ctx);
    const data = accountAdminUpdateSchema.parse(input);
    await assertChildAccount(ctx, id);
    const account = await prisma.account.update({
      where: { id },
      data,
      include: { _count: { select: { screens: true, users: true } } }
    });
    return serializeAccount(account);
  },

  async deleteChildAccount(ctx: AuthContext, id: string) {
    await requireReseller(ctx);
    await assertChildAccount(ctx, id);
    const screens = await prisma.screen.count({ where: { accountId: id } });

    if (screens > 0) {
      throw new ApiError(409, "account_has_screens", "Remova as telas do cliente antes de excluir a conta.");
    }

    await prisma.account.delete({ where: { id } });
    return { id };
  },

  /* ---------- Empresas ---------- */

  async listCompanies(ctx: AuthContext) {
    const companies = await prisma.company.findMany({
      where: { accountId: ctx.accountId },
      include: { _count: { select: { screens: true, media: true } } },
      orderBy: { name: "asc" }
    });
    return companies.map(serializeCompany);
  },

  async createCompany(ctx: AuthContext, input: unknown) {
    requireAdmin(ctx);
    const data = companyCreateSchema.parse(input);
    const company = await prisma.company.create({
      data: { ...data, accountId: ctx.accountId },
      include: { _count: { select: { screens: true, media: true } } }
    });
    return serializeCompany(company);
  },

  async updateCompany(ctx: AuthContext, id: string, input: unknown) {
    requireAdmin(ctx);
    const data = companyUpdateSchema.parse(input);
    await assertCompany(ctx, id);
    const company = await prisma.company.update({
      where: { id },
      data,
      include: { _count: { select: { screens: true, media: true } } }
    });
    return serializeCompany(company);
  },

  async deleteCompany(ctx: AuthContext, id: string) {
    requireAdmin(ctx);
    await assertCompany(ctx, id);
    await prisma.company.delete({ where: { id } });
    return { id };
  },

  /* ---------- Usuários ---------- */

  async listUsers(ctx: AuthContext) {
    requireAdmin(ctx);
    const users = await prisma.user.findMany({
      where: { accountId: ctx.accountId },
      include: { screenAccess: { select: { screenId: true } } },
      orderBy: { name: "asc" }
    });
    return users.map(serializeUser);
  },

  async createUser(ctx: AuthContext, input: unknown) {
    requireAdmin(ctx);
    const data = userCreateSchema.parse(input);
    await assertEmailFree(data.email);
    assertStorageUrl(data.avatarUrl, "avatarUrl");
    const screenIds = await filterAccountScreens(ctx, data.screenIds);

    const user = await prisma.user.create({
      data: {
        accountId: ctx.accountId,
        name: data.name,
        email: data.email,
        passwordHash: await hashPassword(data.password),
        role: data.role,
        avatarUrl: data.avatarUrl ?? null,
        timezone: data.timezone ?? null,
        restrictContent: data.restrictContent,
        screenAccess: { create: screenIds.map((screenId) => ({ screenId })) }
      },
      include: { screenAccess: { select: { screenId: true } } }
    });

    return serializeUser(user);
  },

  async updateUser(ctx: AuthContext, id: string, input: unknown) {
    requireAdmin(ctx);
    const data = userUpdateSchema.parse(input);
    const existing = await prisma.user.findFirst({ where: { id, accountId: ctx.accountId } });

    if (!existing) {
      throw new ApiError(404, "user_not_found", "Usuário não encontrado.");
    }

    if (existing.role === "superadmin" && !ctx.isSuperadmin) {
      throw new ApiError(403, "forbidden", "Não é possível alterar este usuário.");
    }

    if (id === ctx.user.id && (data.isActive === false || (data.role && data.role !== existing.role))) {
      throw new ApiError(422, "cannot_demote_self", "Você não pode desativar ou rebaixar o seu próprio usuário.");
    }

    if (data.email && data.email !== existing.email) {
      await assertEmailFree(data.email);
    }

    assertStorageUrl(data.avatarUrl, "avatarUrl");
    const screenIds = data.screenIds ? await filterAccountScreens(ctx, data.screenIds) : undefined;

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email,
          role: existing.role === "superadmin" ? undefined : data.role,
          avatarUrl: data.avatarUrl,
          timezone: data.timezone,
          isActive: data.isActive,
          restrictContent: data.restrictContent,
          passwordHash: data.password ? await hashPassword(data.password) : undefined
        }
      });

      if (screenIds) {
        await tx.userScreenAccess.deleteMany({ where: { userId: id } });
        await tx.userScreenAccess.createMany({ data: screenIds.map((screenId) => ({ userId: id, screenId })) });
      }

      return tx.user.findUniqueOrThrow({ where: { id }, include: { screenAccess: { select: { screenId: true } } } });
    });

    return serializeUser(user);
  },

  async deleteUser(ctx: AuthContext, id: string) {
    requireAdmin(ctx);

    if (id === ctx.user.id) {
      throw new ApiError(422, "cannot_delete_self", "Você não pode excluir o seu próprio usuário.");
    }

    const existing = await prisma.user.findFirst({ where: { id, accountId: ctx.accountId } });

    if (!existing || (existing.role === "superadmin" && !ctx.isSuperadmin)) {
      throw new ApiError(404, "user_not_found", "Usuário não encontrado.");
    }

    await prisma.user.delete({ where: { id } });
    return { id };
  },

  async updateProfile(ctx: AuthContext, input: unknown) {
    const data = profileUpdateSchema.parse(input);
    assertStorageUrl(data.avatarUrl, "avatarUrl");
    let passwordHash: string | undefined;

    if (data.newPassword) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });

      if (!data.currentPassword || !(await verifyPassword(data.currentPassword, user.passwordHash))) {
        throw new ApiError(422, "invalid_current_password", "Senha atual incorreta.");
      }

      passwordHash = await hashPassword(data.newPassword);
    }

    const user = await prisma.user.update({
      where: { id: ctx.user.id },
      data: { name: data.name, avatarUrl: data.avatarUrl, timezone: data.timezone, passwordHash },
      include: { screenAccess: { select: { screenId: true } } }
    });

    return serializeUser(user);
  },

  /* ---------- Fontes RSS ---------- */

  async listRssSources(ctx: AuthContext) {
    return prisma.rssSource.findMany({
      where: { OR: [{ accountId: ctx.accountId }, { accountId: null }] },
      orderBy: { name: "asc" }
    });
  },

  async createRssSource(ctx: AuthContext, input: unknown) {
    const data = rssSourceCreateSchema.parse(input);
    return prisma.rssSource.create({ data: { ...data, accountId: ctx.accountId } });
  },

  async deleteRssSource(ctx: AuthContext, id: string) {
    const removed = await prisma.rssSource.deleteMany({ where: { id, accountId: ctx.accountId } });
    if (removed.count === 0) throw new ApiError(404, "rss_source_not_found", "Fonte não encontrada.");
    return { id };
  }
};

function requireAdmin(ctx: AuthContext) {
  if (!ctx.isAdmin) {
    throw new ApiError(403, "forbidden", "Acesso restrito a administradores.");
  }
}

async function requireReseller(ctx: AuthContext) {
  requireAdmin(ctx);

  if (ctx.isSuperadmin) {
    return;
  }

  const account = await prisma.account.findUnique({ where: { id: ctx.user.accountId }, select: { kind: true } });

  if (account?.kind !== "reseller") {
    throw new ApiError(403, "forbidden", "Disponível apenas para revendas.");
  }
}

async function assertChildAccount(ctx: AuthContext, id: string) {
  const account = await prisma.account.findUnique({ where: { id } });

  if (!account || id === ctx.user.accountId || (!ctx.isSuperadmin && account.parentId !== ctx.user.accountId)) {
    throw new ApiError(404, "account_not_found", "Conta não encontrada.");
  }

  return account;
}

async function assertCompany(ctx: AuthContext, id: string) {
  const company = await prisma.company.findFirst({ where: { id, accountId: ctx.accountId } });

  if (!company) {
    throw new ApiError(404, "company_not_found", "Empresa não encontrada.");
  }
}

async function assertEmailFree(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    throw new ApiError(409, "email_in_use", "Já existe um usuário com este e-mail.");
  }
}

async function filterAccountScreens(ctx: AuthContext, screenIds: string[]) {
  if (screenIds.length === 0) {
    return [];
  }

  const screens = await prisma.screen.findMany({
    where: { id: { in: screenIds }, accountId: ctx.accountId },
    select: { id: true }
  });

  return screens.map((screen) => screen.id);
}
