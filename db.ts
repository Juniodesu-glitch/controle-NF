import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, notasFiscais, bipagensFaturamento, bipagensExpedicao, solicitacoesAcesso } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Notas Fiscais
export async function getNotasFiscais() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notasFiscais).orderBy(desc(notasFiscais.criadoEm));
}

export async function getNotaFiscalByNumero(numero: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notasFiscais).where(eq(notasFiscais.numero, numero)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createNotaFiscal(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notasFiscais).values(data);
  return result;
}

export async function updateNotaFiscalStatus(id: number, status: "pendente" | "faturada" | "expedida" | "entregue") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(notasFiscais).set({ status }).where(eq(notasFiscais.id, id));
}

// Bipagens de Faturamento
export async function createBipagemFaturamento(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bipagensFaturamento).values(data);
  return result;
}

export async function getBipagensFaturamento() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bipagensFaturamento).orderBy(desc(bipagensFaturamento.criadoEm));
}

// Bipagens de Expedição
export async function createBipagemExpedicao(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bipagensExpedicao).values(data);
  return result;
}

export async function getBipagensExpedicao() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bipagensExpedicao).orderBy(desc(bipagensExpedicao.criadoEm));
}

// Solicitações de Acesso
export async function createSolicitacaoAcesso(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(solicitacoesAcesso).values(data);
}

export async function getSolicitacoesAcesso() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(solicitacoesAcesso).orderBy(desc(solicitacoesAcesso.criadoEm));
}

export async function updateSolicitacaoAcesso(id: number, status: "pendente" | "aprovada" | "rejeitada") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(solicitacoesAcesso).set({ status }).where(eq(solicitacoesAcesso.id, id));
}
