  testeXML: router({
    listarArquivos: protectedProcedure.query(async () => {
      const pastaXML = 'C:/Users/junio.gomes/Capricórnio Têxtil S.A/LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos/nf-app';
      try {
        const arquivos = fs.readdirSync(pastaXML);
        return { arquivos };
      } catch (e) {
        return { erro: 'Não foi possível ler a pasta', detalhes: String(e) };
      }
    }),
  }),
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';

async function buscarXMLPorCodigo(codigoBarras: string, pastaXML: string) {
  const numeroNF = codigoBarras.slice(25, 31); // Posição padrão
  const arquivos = fs.readdirSync(pastaXML);
  for (const arquivo of arquivos) {
    if (arquivo.endsWith('.xml')) {
      const xmlPath = path.join(pastaXML, arquivo);
      const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
      if (xmlContent.includes(numeroNF)) {
        const dados = await xml2js.parseStringPromise(xmlContent);
        return { xmlPath, dados, numeroNF };
      }
    }
  }
  return null;
}
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

function normalizarCodigo(valor: string): string {
  return String(valor || "").trim().replace(/\s+/g, "");
}

function extrairNumeroNF(codigoLido: string): string {
  const valor = normalizarCodigo(codigoLido);
  if (!valor) return "";

  const digits = valor.replace(/\D/g, "");
  if (digits.length === 44) {
    const nNF = digits.slice(25, 34).replace(/^0+/, "");
    return nNF || "0";
  }

  const chave = digits.match(/\d{44}/);
  if (chave) {
    const nNF = chave[0].slice(25, 34).replace(/^0+/, "");
    return nNF || "0";
  }

  return digits || valor;
}

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
        const numeroNFExtraido = extrairNumeroNF(input.numeroNF);
        // Extrai a chave de acesso (44 dígitos) do código bipado
        const digits = input.numeroNF.replace(/\D/g, "");
        let chaveAcesso = null;
        if (digits.length === 44) {
          chaveAcesso = digits;
        } else {
          const chave = digits.match(/\d{44}/);
          if (chave) chaveAcesso = chave[0];
        }
        // Upsert da chave de acesso na tabela nfs
        if (chaveAcesso) {
          await db.upsertChaveAcessoNFS(chaveAcesso);
        }

        const notaFiscal = await db.getNotaFiscalByNumero(numeroNFExtraido || input.numeroNF);
        if (!notaFiscal) {
          // Não lança erro, apenas retorna aguardando XML
          return {
            success: true,
            notaFiscal: null,
            xmlSalvo: false,
            xmlArquivo: "",
            xmlMotivo: "Nota fiscal não encontrada. Chave de acesso salva e aguardando integração do XML.",
          };
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

        return {
          success: true,
          notaFiscal,
          xmlSalvo: false,
          xmlArquivo: "",
          xmlMotivo: "XML será processado somente pelo importador da pasta configurada",
        };
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

    bipar: protectedProcedure
      .input(z.object({
        numeroNF: z.string(),
        dataHora: z.date(),
        dataHoraManual: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const pastaXML = 'C:/Users/junio.gomes/Capricórnio Têxtil S.A/LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos/nf-app';
        const resultado = await buscarXMLPorCodigo(input.numeroNF, pastaXML);
        if (!resultado) {
          return {
            success: false,
            notaFiscal: null,
            xmlSalvo: false,
            xmlArquivo: '',
            xmlMotivo: 'XML não encontrado na pasta local.',
          };
        }
        const { xmlPath, dados, numeroNF } = resultado;
        const chaveAcesso = input.numeroNF.replace(/\D/g, "").slice(0, 44);
        const cliente = dados?.NFe?.infNFe?.[0]?.dest?.[0]?.xNome?.[0] || '';
        const valor = dados?.NFe?.infNFe?.[0]?.total?.[0]?.ICMSTot?.[0]?.vNF?.[0] || '';
        await db.upsertChaveAcessoNFS(chaveAcesso);
        await db.createNotaFiscal({
          chave_acesso: chaveAcesso,
          numero_nf: numeroNF,
          cliente,
          valor,
          xml_arquivo: xmlPath,
        });
        return {
          success: true,
          notaFiscal: {
            chave_acesso: chaveAcesso,
            numero_nf: numeroNF,
            cliente,
            valor,
            xml_arquivo: xmlPath,
          },
          xmlSalvo: true,
          xmlArquivo: xmlPath,
          xmlMotivo: 'XML encontrado e NF salva no banco.',
        };
      }),
