import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

// Helper para verificar se é admin
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Solicitações de Acesso
  solicitacoes: router({
    criar: publicProcedure
      .input(z.object({
        email: z.string().email(),
        nome: z.string(),
        papel: z.enum(["faturista", "conferente"]),
      }))
      .mutation(async ({ input }) => {
        await db.createSolicitacaoAcesso({
          email: input.email,
          nome: input.nome,
          papel: input.papel,
        });
        return { success: true };
      }),

    listar: adminProcedure.query(async () => {
      return await db.getSolicitacoesAcesso();
    }),

    aprovar: adminProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input }) => {
        const id = typeof input.id === "string" ? Number(input.id) : input.id;
        if (!Number.isFinite(id)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ID de solicitação inválido" });
        }

        const update = await db.updateSolicitacaoAcesso(id, "aprovada");
        if (update.affectedRows === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada para aprovação" });
        }

        return { success: true };
      }),

    rejeitar: adminProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input }) => {
        const id = typeof input.id === "string" ? Number(input.id) : input.id;
        if (!Number.isFinite(id)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ID de solicitação inválido" });
        }

        const update = await db.updateSolicitacaoAcesso(id, "rejeitada");
        if (update.affectedRows === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada para rejeição" });
        }

        return { success: true };
      }),
  }),

  // Notas Fiscais
  notasFiscais: router({
    listar: protectedProcedure.query(async () => {
      return await db.getNotasFiscais();
    }),

    criar: adminProcedure
      .input(z.object({
        numero: z.string(),
        serie: z.string(),
        cliente: z.string(),
        valor: z.string(),
        dataEmissao: z.date(),
      }))
      .mutation(async ({ input }) => {
        const existente = await db.getNotaFiscalByNumero(input.numero);
        if (existente) {
          throw new TRPCError({ code: "CONFLICT", message: "Nota fiscal já existe" });
        }
        await db.createNotaFiscal({
          numero: input.numero,
          serie: input.serie,
          cliente: input.cliente,
          valor: input.valor,
          dataEmissao: input.dataEmissao,
          status: "pendente",
        });
        return { success: true };
      }),
  }),

  // Bipagens de Faturamento
  faturamento: router({
    bipar: protectedProcedure
      .input(z.object({
        numeroNF: z.string(),
        dataHora: z.date(),
        dataHoraManual: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const notaFiscal = await db.getNotaFiscalByNumero(input.numeroNF);
        if (!notaFiscal) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Nota fiscal não encontrada" });
        }

        // Registrar bipagem
        await db.createBipagemFaturamento({
          notaFiscalId: notaFiscal.id,
          usuarioId: ctx.user.id,
          dataHora: input.dataHora,
          dataHoraManual: input.dataHoraManual,
        });

        // Atualizar status da NF
        await db.updateNotaFiscalStatus(notaFiscal.id, "faturada");

        return { success: true, notaFiscal };
      }),

    listar: protectedProcedure.query(async () => {
      return await db.getBipagensFaturamento();
    }),
  }),

  // Bipagens de Expedição
  expedicao: router({
    bipar: protectedProcedure
      .input(z.object({
        numeroNF: z.string(),
        dataHora: z.date(),
        dataHoraManual: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const notaFiscal = await db.getNotaFiscalByNumero(input.numeroNF);
        if (!notaFiscal) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Nota fiscal não encontrada" });
        }

        // Registrar bipagem
        await db.createBipagemExpedicao({
          notaFiscalId: notaFiscal.id,
          usuarioId: ctx.user.id,
          dataHora: input.dataHora,
          dataHoraManual: input.dataHoraManual,
        });

        // Atualizar status da NF
        await db.updateNotaFiscalStatus(notaFiscal.id, "expedida");

        return { success: true, notaFiscal };
      }),

    listar: protectedProcedure.query(async () => {
      return await db.getBipagensExpedicao();
    }),
  }),

  // Painel Administrativo
  admin: router({
    usuarios: adminProcedure.query(async () => {
      // Retorna lista de usuários (implementar conforme necessário)
      return [];
    }),

    exportarPlanilha: adminProcedure
      .input(z.object({
        tipo: z.enum(["notasFiscais", "faturamento", "expedicao"]),
      }))
      .mutation(async ({ input }) => {
        // Implementar exportação de planilhas
        return { success: true, url: "#" };
      }),
  }),

  // Configurações de Sistema
  settings: router({
    getNfSourcePath: adminProcedure.query(async () => {
      const { loadSettings, suggestOnedrivePaths, getExpandedNfSourcePath } = await import("./settings");
      const settings = loadSettings();
      const suggestions = suggestOnedrivePaths();
      
      let currentPath = settings.nfSourcePath;
      let expandedPath = "";
      let isAccessible = false;

      try {
        expandedPath = getExpandedNfSourcePath();
        isAccessible = true;
      } catch {
        // Caminho não configurado ou inválido
      }

      return {
        currentPath,
        expandedPath,
        isAccessible,
        sourceType: settings.sourceType,
        suggestions,
        lastUpdated: settings.lastUpdated,
      };
    }),

    setNfSourcePath: adminProcedure
      .input(
        z.object({
          nfSourcePath: z.string().min(1, "Caminho obrigatório"),
          sourceType: z.enum(["local", "network", "onedrive-pattern"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { loadSettings, saveSettings, validatePath, expandPath } = await import("./settings");
        
        // Validar o caminho
        const validation = validatePath(input.nfSourcePath);
        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.error || "Caminho inválido",
          });
        }

        // Salvar configurações
        const settings = loadSettings();
        settings.nfSourcePath = input.nfSourcePath;
        settings.sourceType = input.sourceType;
        settings.lastUpdated = new Date().toISOString();
        settings.updatedBy = ctx.user.email || ctx.user.id;
        saveSettings(settings);

        return {
          success: true,
          message: `Caminho atualizado com sucesso. ${validation.fileCount || 0} XMLs encontrados.`,
          expandedPath: expandPath(input.nfSourcePath),
          fileCount: validation.fileCount,
        };
      }),

    validateNfPath: adminProcedure
      .input(z.object({ nfSourcePath: z.string() }))
      .mutation(async ({ input }) => {
        const { validatePath, expandPath } = await import("./settings");
        const validation = validatePath(input.nfSourcePath);
        return {
          valid: validation.valid,
          error: validation.error,
          fileCount: validation.fileCount,
          expandedPath: validation.valid ? expandPath(input.nfSourcePath) : "",
        };
      }),

    getSettingsInfo: adminProcedure.query(async () => {
      const { loadSettings } = await import("./settings");
      const settings = loadSettings();
      return {
        nfSourcePath: settings.nfSourcePath,
        sourceType: settings.sourceType,
        lastUpdated: settings.lastUpdated,
        updatedBy: settings.updatedBy,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
