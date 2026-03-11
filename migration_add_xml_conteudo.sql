-- ============================================================
-- MIGRAÇÃO: Adicionar colunas xml_conteudo e chave_acesso
-- ============================================================
-- Execute este SQL no SQL Editor do Supabase UMA VEZ.
-- É seguro rodar mais de uma vez (idempotente).
--
-- Essas colunas permitem:
-- 1. xml_conteudo: armazenar o XML completo da NF no banco,
--    eliminando a dependência do servidor XML local (nf-xml-server.js).
--    O frontend baixa o XML direto do Supabase quando o faturista bipa.
--
-- 2. chave_acesso: chave de 44 dígitos da NF-e para consultas.
-- ============================================================

begin;

-- Adiciona coluna para armazenar o conteúdo XML completo da NF
alter table public.nfs add column if not exists xml_conteudo text;

-- Adiciona coluna para a chave de acesso (44 dígitos)
alter table public.nfs add column if not exists chave_acesso text;

-- Policy de leitura para xml_conteudo (já coberta pela policy existente nfs_select_authenticated)
-- Nenhuma policy nova é necessária.

commit;
