import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "user-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("Solicitações Router", () => {
  it("should create a new access request", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const result = await caller.solicitacoes.criar({
      email: "test@example.com",
      nome: "Test User",
      papel: "faturista",
    });

    expect(result).toEqual({ success: true });
  });

  it("should list access requests as admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const result = await caller.solicitacoes.listar();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should deny access request listing for non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());

    try {
      await caller.solicitacoes.listar();
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});

describe("Notas Fiscais Router", () => {
  it("should list notas fiscais for authenticated users", async () => {
    const caller = appRouter.createCaller(createUserContext());

    const result = await caller.notasFiscais.listar();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should create nota fiscal as admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const result = await caller.notasFiscais.criar({
      numero: "NF-001",
      serie: "1",
      cliente: "Test Client",
      valor: "1000.00",
      dataEmissao: new Date(),
    });

    expect(result).toEqual({ success: true });
  });

  it("should deny nota fiscal creation for non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());

    try {
      await caller.notasFiscais.criar({
        numero: "NF-002",
        serie: "1",
        cliente: "Test Client",
        valor: "1000.00",
        dataEmissao: new Date(),
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});

describe("Faturamento Router", () => {
  it("should record faturamento bipagem for authenticated users", async () => {
    const caller = appRouter.createCaller(createUserContext());

    try {
      const result = await caller.faturamento.bipar({
        numeroNF: "NF-001",
        dataHora: new Date(),
        dataHoraManual: false,
      });

      expect(result).toHaveProperty("success");
    } catch (error: any) {
      // Expected if NF doesn't exist
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("should list faturamento bipagens", async () => {
    const caller = appRouter.createCaller(createUserContext());

    const result = await caller.faturamento.listar();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Expedição Router", () => {
  it("should record expedicao bipagem for authenticated users", async () => {
    const caller = appRouter.createCaller(createUserContext());

    try {
      const result = await caller.expedicao.bipar({
        numeroNF: "NF-001",
        dataHora: new Date(),
        dataHoraManual: false,
      });

      expect(result).toHaveProperty("success");
    } catch (error: any) {
      // Expected if NF doesn't exist
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("should list expedicao bipagens", async () => {
    const caller = appRouter.createCaller(createUserContext());

    const result = await caller.expedicao.listar();

    expect(Array.isArray(result)).toBe(true);
  });
});
