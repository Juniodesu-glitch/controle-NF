# Configuração de Origem de XMLs - NF-App

## Visão Geral

O sistema foi redesenhado para **não ficar preso a uma máquina específica**. Agora você pode configurar a origem dos XMLs de forma centralizada, acessível por qualquer máquina autorizada.

## Como Funciona

### 1. **Painel de Configuração (Interface Web)**

No Painel Administrativo → Aba **Configurações**:

- ✅ Visualizar o caminho atual da pasta de NF
- ✅ Testar e validar caminhos
- ✅ Contar quantos XMLs existem na pasta
- ✅ Ver sugestões de pastas OneDrive detectadas
- ✅ Histórico de quando foi atualizado e por quem

### 2. **Tipos de Origem Suportados**

#### **A) OneDrive/SharePoint (Recomendado)**
```
Tipo: onedrive-pattern
Caminho: C:\Users\[user]\Capricórnio Têxtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app
```
✅ Sincronizado na nuvem
✅ Acesso de múltiplas máquinas
✅ Backup automático

#### **B) Rede/Servidor (UNC Path)**
```
Tipo: network
Caminho: \\servidor-empresa\LOGISTICA\nf-app
```
✅ Acesso centralizado
✅ Sem depender de sincronização local
✅ Controle de permissões via rede

#### **C) Local (Máquina Específica)**
```
Tipo: local
Caminho: C:\Local\nf-app
```
⚠️ Funciona, mas limita a uma máquina

### 3. **Variáveis de Ambiente Suportadas**

O sistema expande automaticamente:

```bash
# Exemplos válidos:
%USERPROFILE%\OneDrive\LOGISTICA\nf-app
$HOME\LOGISTICA\nf-app
{APPDATA}\...\nf-app
```

## Configuração Passo a Passo

### **Opção 1: OneDrive Compartilhado (Melhor)**

1. **No OneDrive da Capricórnio:**
   - Abra a pasta `LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos/nf-app`
   - Copie o caminho local onde está sincronizado

2. **No Painel Admin:**
   - Vá em **Configurações**
   - Cole o caminho na pasta
   - Selecione tipo: `OneDrive (com padrões de busca)`
   - Clique em **Validar** 
   - Se OK, clique em **Salvar Configuração**

3. **O importador automaticamente:**
   - Detectará mudanças na pasta
   - Importará novos XMLs
   - Funcionará em qualquer máquina com OneDrive sincronizado

### **Opção 2: Servidor de Rede (Corporativo)**

1. **No servidor da empresa:**
   - Compartilhe a pasta com permissão de leitura
   - Exemplo: `\\servidor-logistica\arquivos\nf-app`

2. **No Painel Admin:**
   - Digite o caminho UNC
   - Selecione tipo: `Rede (\\servidor\pasta)`
   - Valide e salve

3. **Resultado:**
   - Qualquer máquina na rede acessa os mesmos XMLs
   - Independente de usuário ou máquina

## Entendendo o Arquivo `app-settings.json`

O arquivo é criado automaticamente na raiz do projeto:

```json
{
  "nfSourcePath": "C:\\Users\\...\\OneDrive\\LOGISTICA\\nf-app",
  "sourceType": "onedrive-pattern",
  "lastUpdated": "2026-03-11T14:30:00.000Z",
  "updatedBy": "admin@empresa.com"
}
```

**Não edite manualmente** - use a interface do painel!

## Como o Importador Usa Isso

### **Prioridade de Leitura:**

1. **Variável de ambiente `NF_SOURCE_DIR`** (se definida)
2. **`app-settings.json`** (configurado na interface)
3. **Auto-descoberta** (procura padrões comuns)

### **Exemplo: run_importer.bat**

```batch
@echo off
REM O arquivo settings.py carregará app-settings.json automaticamente
python importer.py
```

## Resolução de Problemas

### ❌ "Caminho não encontrado"

1. Verifique se digitou corretamente
2. Veja **Sugestões** de pastas detectadas
3. Para OneDrive, pode estar sincronizando - espere um pouco

### ❌ "Permissão negada" em rede

1. Peça acesso ao compartilhamento
2. Verifique se o usuário tem permissões de leitura
3. Teste com `net use \\servidor\pasta`

### ❌ XMLs não importam

1. Vá em **Configurações**
2. Clique em **Validar** - vê quantos XMLs achou?
3. Se achou, verifique eventos de erro no servidor
4. Se não achou, o caminho está errado

## Recomendação Arquitetônica

Para **máquinas múltiplas**, use:

```
┌─────────────────────────────────┐
│   SERVIDOR / ONEDRIVE CENTRAL   │
│   \\servidor\nf-app   (readonly)│
│   ou OneDrive sincronizado      │
└──────────────┬──────────────────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
  MÁQUINA-1 MÁQUINA-2 MÁQUINA-3
  (Faturista) (Conferente)(Admin)
  Todas acessam o mesmo source
```

**Vantagens:**
- ✅ Uma única fonte de verdade
- ✅ Sem duplicação de XMLs
- ✅ Sincronização automática
- ✅ Escalável para novos usuários

## Próximos Passos

1. **Defina a origem (OneDrive ou Rede)**
2. **Configure via Painel Admin**
3. **Reinicie o importador** (run_importer.bat)
4. **Teste:** Adicione um XML novo e verifique se importa

---

*Para suporte técnico, verifique os logs em `logs/importer.log`*
