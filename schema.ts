import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Notas Fiscais - Registro de todas as NF no sistema
 */
export const notasFiscais = mysqlTable("notas_fiscais", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 50 }).notNull().unique(),
  serie: varchar("serie", { length: 10 }).notNull(),
  cliente: varchar("cliente", { length: 255 }).notNull(),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pendente", "faturada", "expedida", "entregue"]).default("pendente").notNull(),
  dataEmissao: timestamp("dataEmissao").notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type NotaFiscal = typeof notasFiscais.$inferSelect;
export type InsertNotaFiscal = typeof notasFiscais.$inferInsert;

/**
 * Bipagens de Faturamento - Registro de quando uma NF foi faturada
 */
export const bipagensFaturamento = mysqlTable("bipagens_faturamento", {
  id: int("id").autoincrement().primaryKey(),
  notaFiscalId: int("notaFiscalId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  dataHora: timestamp("dataHora").notNull(),
  dataHoraManual: boolean("dataHoraManual").default(false).notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type BipagemFaturamento = typeof bipagensFaturamento.$inferSelect;
export type InsertBipagemFaturamento = typeof bipagensFaturamento.$inferInsert;

/**
 * Bipagens de Expedição - Registro de quando uma NF foi expedida
 */
export const bipagensExpedicao = mysqlTable("bipagens_expedicao", {
  id: int("id").autoincrement().primaryKey(),
  notaFiscalId: int("notaFiscalId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  dataHora: timestamp("dataHora").notNull(),
  dataHoraManual: boolean("dataHoraManual").default(false).notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type BipagemExpedicao = typeof bipagensExpedicao.$inferSelect;
export type InsertBipagemExpedicao = typeof bipagensExpedicao.$inferInsert;

/**
 * Solicitações de Acesso - Usuários aguardando aprovação
 */
export const solicitacoesAcesso = mysqlTable("solicitacoes_acesso", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  papel: mysqlEnum("papel", ["faturista", "conferente"]).notNull(),
  status: mysqlEnum("status", ["pendente", "aprovada", "rejeitada"]).default("pendente").notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type SolicitacaoAcesso = typeof solicitacoesAcesso.$inferSelect;
export type InsertSolicitacaoAcesso = typeof solicitacoesAcesso.$inferInsert;