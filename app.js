// ========================================
// SISTEMA TMS - GESTÃO DE FATURAMENTO E EXPEDIÇÃO
// ========================================

const APP_TITLE = 'System';

// Estado global da aplicação
const appState = {
    currentPage: 'login',
    currentUser: null,
    notasFiscais: [],
    bipagensFaturamento: [],
    bipagensExpedicao: [],
    solicitacoes: [],
    usuarios: [],
    xmlApiBaseUrls: ['http://127.0.0.1:8787', 'http://localhost:8787'],
    xmlServiceStatus: {
        indisponivel: false,
        ultimoAviso: 0,
        avisoConsoleEmitido: false,
    },
    scanTimers: {
        faturamento: null,
        expedicao: null,
    }
};

// Dados simulados para demonstração
const dadosSimulados = {
    notasFiscais: [
        { id: 1, numero: 'NF-001', serie: '1', cliente: 'Empresa A', valor: '1500.00', status: 'pendente', dataEmissao: '2024-03-01' },
        { id: 2, numero: 'NF-002', serie: '1', cliente: 'Empresa B', valor: '2300.00', status: 'faturada', dataEmissao: '2024-03-02' },
        { id: 3, numero: 'NF-003', serie: '1', cliente: 'Empresa C', valor: '890.50', status: 'expedida', dataEmissao: '2024-03-03' },
        { id: 4, numero: 'NF-004', serie: '1', cliente: 'Empresa D', valor: '3200.00', status: 'pendente', dataEmissao: '2024-03-04' },
        { id: 5, numero: 'NF-005', serie: '1', cliente: 'Empresa E', valor: '1750.00', status: 'faturada', dataEmissao: '2024-03-05' },
    ],
    usuarios: [
        { id: 1, nome: 'Admin User', email: 'junio.gomes@capricornio.com.br', senha: 'admin123', papel: 'admin', status: 'ativo' },
        { id: 2, nome: 'João Faturista', email: 'joao@tms.com', senha: 'joao123', papel: 'faturista', status: 'ativo' },
        { id: 3, nome: 'Maria Conferente', email: 'maria@tms.com', senha: 'maria123', papel: 'conferente', status: 'ativo' },
    ],
    solicitacoes: [
        { id: 1, nome: 'Pedro Silva', email: 'pedro@email.com', senha: 'pedro123', papel: 'faturista', status: 'pendente' },
        { id: 2, nome: 'Ana Santos', email: 'ana@email.com', senha: 'ana123', papel: 'conferente', status: 'pendente' },
    ]
};

const runtimeConfig = (typeof window !== 'undefined' && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : {};

const supabaseConfig = {
    url: runtimeConfig.supabaseUrl || 'https://ttxobirrlaetnnnpalfk.supabase.co',
    key: runtimeConfig.supabaseAnonKey || 'sb_publishable_GVL27-8GCdfuBmm83HveYA_eaiRBLgp',
    tables: {
        perfis: 'profiles',
        solicitacoes: 'solicitacoes_acesso',
        nfs: 'nfs',
        bipagens: 'bipagens',
    },
};

appState.supabase = {
    conectado: false,
    nfIdPorNumero: {},
};

appState.auth = {
    accessToken: null,
    refreshToken: null,
    user: null,
};

appState.sync = {
    timer: null,
    intervalMs: 12000,
    emAndamento: false,
};

appState.filtros = {
    transportadoraFaturista: '',
};

async function sincronizarDadosEmSegundoPlano() {
    if (!appState.currentUser || appState.sync.emAndamento) return;

    appState.sync.emAndamento = true;
    try {
        await carregarDadosSupabase();

        // Evita re-render durante a bipagem para não perder foco do leitor.
        if (appState.currentPage === 'dashboard' && appState.currentUser.papel === 'admin') {
            renderizar();
        }
    } catch (error) {
        // Silencioso para não poluir UX; erros já são tratados na carga do Supabase.
    } finally {
        appState.sync.emAndamento = false;
    }
}

function iniciarSincronizacaoAutomatica() {
    pararSincronizacaoAutomatica();
    appState.sync.timer = setInterval(() => {
        void sincronizarDadosEmSegundoPlano();
    }, appState.sync.intervalMs);
}

function pararSincronizacaoAutomatica() {
    if (appState.sync.timer) {
        clearInterval(appState.sync.timer);
        appState.sync.timer = null;
    }
}

function setAuthSession(session) {
    appState.auth.accessToken = session && session.access_token ? session.access_token : null;
    appState.auth.refreshToken = session && session.refresh_token ? session.refresh_token : null;
    appState.auth.user = session && session.user ? session.user : null;
}

function clearAuthSession() {
    appState.auth.accessToken = null;
    appState.auth.refreshToken = null;
    appState.auth.user = null;
}

async function supabaseAuthRequest(path, options = {}) {
    const method = options.method || 'GET';
    const headers = {
        apikey: supabaseConfig.key,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (options.accessToken) {
        headers.Authorization = `Bearer ${options.accessToken}`;
    }

    const response = await fetch(`${supabaseConfig.url}/auth/v1/${path}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let parsed = null;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = null;
    }

    if (!response.ok) {
        const msg = parsed && (parsed.msg || parsed.error_description || parsed.error)
            ? (parsed.msg || parsed.error_description || parsed.error)
            : text;
        throw new Error(`Supabase Auth ${method} ${path} -> ${response.status}: ${msg}`);
    }

    return parsed;
}

async function supabaseAuthSignIn(email, senha) {
    const data = await supabaseAuthRequest('token?grant_type=password', {
        method: 'POST',
        body: {
            email,
            password: senha,
        },
    });

    setAuthSession(data);
    return data;
}

async function supabaseAuthSignUp(email, senha, nome) {
    return supabaseAuthRequest('signup', {
        method: 'POST',
        body: {
            email,
            password: senha,
            data: {
                nome: String(nome || ''),
            },
        },
    });
}

async function supabaseAuthSignOut() {
    if (!appState.auth.accessToken) {
        clearAuthSession();
        return;
    }

    try {
        await supabaseAuthRequest('logout', {
            method: 'POST',
            accessToken: appState.auth.accessToken,
        });
    } catch (error) {
        // Se falhar logout remoto, limpa sessão local para não travar o fluxo.
    }

    clearAuthSession();
}

async function garantirPerfilPorAuth(authUser, nomeHint) {
    if (!authUser || !authUser.id || !authUser.email) {
        return null;
    }

    const authId = String(authUser.id);
    const email = String(authUser.email).toLowerCase();

    let rows = await supabaseRequest(
        `${supabaseConfig.tables.perfis}?select=*&id=eq.${encodeURIComponent(authId)}&limit=1`
    ).catch(() => []);

    if (!Array.isArray(rows) || rows.length === 0) {
        rows = await supabaseRequest(
            `${supabaseConfig.tables.perfis}?select=*&auth_user_id=eq.${encodeURIComponent(authId)}&limit=1`
        ).catch(() => []);
    }

    if (!Array.isArray(rows) || rows.length === 0) {
        rows = await supabaseRequest(
            `${supabaseConfig.tables.perfis}?select=*&email=eq.${encodeURIComponent(email)}&limit=1`
        ).catch(() => []);
    }

    const nomeBase = String(nomeHint || authUser.user_metadata?.nome || authUser.email.split('@')[0] || 'Usuário');

    if (Array.isArray(rows) && rows.length > 0) {
        const existente = rows[0];
        if (!existente.auth_user_id || String(existente.auth_user_id) !== authId || !existente.nome) {
            await supabaseRequest(`${supabaseConfig.tables.perfis}?id=eq.${encodeURIComponent(existente.id)}`, {
                method: 'PATCH',
                body: {
                    auth_user_id: authId,
                    nome: existente.nome || nomeBase,
                    email,
                },
            }).catch(() => null);
            existente.auth_user_id = authId;
            existente.nome = existente.nome || nomeBase;
            existente.email = email;
        }
        return mapPerfilRowToLocal(existente);
    }

    const inserted = await supabaseRequest(`${supabaseConfig.tables.perfis}?select=*`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
            id: authId,
            auth_user_id: authId,
            nome: nomeBase,
            email,
            role: 'conferente',
            ativo: false,
        },
    }).catch(() => []);

    if (Array.isArray(inserted) && inserted.length > 0) {
        return mapPerfilRowToLocal(inserted[0]);
    }

    return null;
}

function getSupabaseHeaders() {
    const bearer = appState.auth.accessToken || supabaseConfig.key;
    return {
        apikey: supabaseConfig.key,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
    };
}

async function supabaseRequest(path, options = {}) {
    const method = options.method || 'GET';
    const headers = {
        ...getSupabaseHeaders(),
        ...(options.headers || {}),
    };

    const response = await fetch(`${supabaseConfig.url}/rest/v1/${path}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
        const erroTexto = await response.text();
        throw new Error(`Supabase ${method} ${path} -> ${response.status}: ${erroTexto}`);
    }

    const texto = await response.text();
    if (!texto) return null;

    try {
        return JSON.parse(texto);
    } catch {
        return null;
    }
}

async function supabaseRpc(functionName, args = {}) {
    const response = await fetch(`${supabaseConfig.url}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: getSupabaseHeaders(),
        body: JSON.stringify(args),
    });

    if (!response.ok) {
        const erroTexto = await response.text();
        throw new Error(`Supabase RPC ${functionName} -> ${response.status}: ${erroTexto}`);
    }

    const texto = await response.text();
    if (!texto) return null;

    try {
        return JSON.parse(texto);
    } catch {
        return texto;
    }
}

function mapPerfilRowToLocal(row) {
    return {
        id: row.id || Math.floor(Math.random() * 1_000_000_000),
        nome: row.nome || row.name || '',
        email: row.email || '',
        senha: row.senha || '',
        papel: row.role || row.papel || 'faturista',
        status: row.ativo === false ? 'inativo' : 'ativo',
    };
}

function mapSolicitacaoRowToLocal(row) {
    const statusNormalizado = String(row.status || 'pendente').trim().toLowerCase();
    return {
        id: row.id || Math.floor(Math.random() * 1_000_000_000),
        nome: row.nome || '',
        email: row.email || '',
        senha: row.senha || '',
        papel: row.role_solicitado || row.papel || 'faturista',
        status: statusNormalizado,
    };
}

function mapNfRowToLocal(row) {
    return {
        id: row.id || Math.floor(Math.random() * 1_000_000_000),
        numero: row.numero_nf || row.numero || '',
        serie: row.serie || '1',
        cliente: row.cliente || 'Cliente não informado',
        transportadora: row.transportadora || 'Não informada',
        artigo: row.artigo || '-',
        pedido: row.pedido || '-',
        quantidadeItens: Number(row.quantidade_itens || 0),
        metros: Number(row.metros || 0),
        pesoBruto: Number(row.peso_bruto || 0),
        valor: String(row.valor_total ?? '0.00'),
        status: row.status || 'pendente',
        dataEmissao: row.data_emissao || new Date().toISOString().slice(0, 10),
    };
}

function normalizarTipoBipagem(tipo) {
    const valor = String(tipo || '').trim().toLowerCase();
    if (!valor) return 'faturamento';

    if (valor === 'expedicao' || valor === 'expedição' || valor === 'conferencia' || valor === 'conferente') {
        return 'expedicao';
    }

    if (valor === 'faturamento' || valor === 'faturista' || valor === 'despertador' || valor === 'billing') {
        return 'faturamento';
    }

    return valor;
}

function mapBipagemRowToLocal(row, notasPorId) {
    const nota = notasPorId[row.nf_id];
    const tipoNormalizado = normalizarTipoBipagem(row.tipo);
    return {
        id: row.id || Math.random(),
        notaFiscalId: row.nf_id,
        numeroNF: nota ? nota.numero : String(row.numero_nf || ''),
        cliente: nota ? nota.cliente : 'Cliente não informado',
        transportadora: nota ? nota.transportadora : 'Não informada',
        artigo: nota ? nota.artigo : '-',
        pedido: nota ? nota.pedido : '-',
        quantidadeItens: nota ? Number(nota.quantidadeItens || 0) : 0,
        metros: nota ? Number(nota.metros || 0) : 0,
        pesoBruto: nota ? Number(nota.pesoBruto || 0) : 0,
        valor: nota ? nota.valor : '0.00',
        dataHora: row.data_hora || row.criado_em || new Date().toISOString(),
        dataHoraManual: Boolean(row.data_hora_manual),
        criadoEm: row.criado_em
            ? new Date(row.criado_em).toLocaleString('pt-BR')
            : new Date().toLocaleString('pt-BR'),
        tipo: tipoNormalizado,
    };
}

async function carregarDadosSupabase() {
    try {
        const [nfsRows, bipagensRows, solicitacoesRows, perfisRows] = await Promise.all([
            supabaseRequest(`${supabaseConfig.tables.nfs}?select=*&order=id.asc`).catch(() => []),
            supabaseRequest(`${supabaseConfig.tables.bipagens}?select=*&order=id.asc`).catch(() => []),
            supabaseRequest(`${supabaseConfig.tables.solicitacoes}?select=*&order=id.asc`).catch(() => []),
            supabaseRequest(`${supabaseConfig.tables.perfis}?select=*&order=id.asc`).catch(() => []),
        ]);

        if (Array.isArray(nfsRows) && nfsRows.length > 0) {
            appState.notasFiscais = nfsRows.map(mapNfRowToLocal);
        }

        appState.usuarios = Array.isArray(perfisRows) ? perfisRows.map(mapPerfilRowToLocal) : [];
        appState.solicitacoes = Array.isArray(solicitacoesRows) ? solicitacoesRows.map(mapSolicitacaoRowToLocal) : [];

        const notasPorId = {};
        appState.supabase.nfIdPorNumero = {};
        appState.notasFiscais.forEach((nf) => {
            notasPorId[nf.id] = nf;
            appState.supabase.nfIdPorNumero[String(nf.numero)] = nf.id;
        });

        if (Array.isArray(bipagensRows) && bipagensRows.length > 0) {
            const bipagensLocal = bipagensRows.map((row) => mapBipagemRowToLocal(row, notasPorId));
            appState.bipagensFaturamento = bipagensLocal.filter((b) => b.tipo === 'faturamento');
            appState.bipagensExpedicao = bipagensLocal.filter((b) => b.tipo === 'expedicao');
        }

        appState.supabase.conectado = true;
    } catch (error) {
        appState.supabase.conectado = false;
        console.warn('[Supabase] Falha ao carregar dados iniciais:', error?.message || error);
    }
}

function numeroToDbValue(nota) {
    return String(nota.numero || '').replace(/[^0-9]/g, '') || String(nota.numero || '');
}

async function garantirNfNoSupabase(nota) {
    const numeroDb = numeroToDbValue(nota);
    if (!numeroDb) return null;

    const idCache = appState.supabase.nfIdPorNumero[numeroDb];
    if (idCache) {
        return idCache;
    }

    const busca = await supabaseRequest(
        `${supabaseConfig.tables.nfs}?select=id,numero_nf&numero_nf=eq.${encodeURIComponent(numeroDb)}&limit=1`
    ).catch(() => []);

    if (Array.isArray(busca) && busca.length > 0) {
        const id = busca[0].id;
        appState.supabase.nfIdPorNumero[numeroDb] = id;
        return id;
    }

    const insertBody = {
        numero_nf: numeroDb,
        serie: String(nota.serie || '1'),
        pedido: String(nota.pedido || '-'),
        cliente: String(nota.cliente || 'Cliente não informado'),
        transportadora: String(nota.transportadora || 'Não informada'),
        artigo: String(nota.artigo || '-'),
        quantidade_itens: Number(nota.quantidadeItens || 0),
        metros: Number(nota.metros || 0),
        peso_bruto: Number(nota.pesoBruto || 0),
        valor_total: Number(nota.valor || 0),
        data_emissao: nota.dataEmissao || null,
        status: String(nota.status || 'pendente'),
    };

    const inserted = await supabaseRequest(`${supabaseConfig.tables.nfs}?select=id,numero_nf`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: insertBody,
    }).catch(() => []);

    const novoId = Array.isArray(inserted) && inserted[0] ? inserted[0].id : null;
    if (novoId) {
        appState.supabase.nfIdPorNumero[numeroDb] = novoId;
        return novoId;
    }

    return null;
}

async function sincronizarNfSupabase(nota) {
    try {
        const nfId = await garantirNfNoSupabase(nota);
        if (!nfId) return;

        await supabaseRequest(`${supabaseConfig.tables.nfs}?id=eq.${encodeURIComponent(nfId)}`, {
            method: 'PATCH',
            body: {
                pedido: String(nota.pedido || '-'),
                cliente: String(nota.cliente || 'Cliente não informado'),
                transportadora: String(nota.transportadora || 'Não informada'),
                artigo: String(nota.artigo || '-'),
                quantidade_itens: Number(nota.quantidadeItens || 0),
                metros: Number(nota.metros || 0),
                peso_bruto: Number(nota.pesoBruto || 0),
                valor_total: Number(nota.valor || 0),
                data_emissao: nota.dataEmissao || null,
                status: String(nota.status || 'pendente'),
            },
        });
    } catch (error) {
        console.warn('[Supabase] Falha ao sincronizar NF:', error?.message || error);
    }
}

async function sincronizarBipagemSupabase(nota, tipo, dataHora, dataHoraManual) {
    try {
        const tipoNormalizado = normalizarTipoBipagem(tipo);
        const nfId = await garantirNfNoSupabase(nota);
        if (!nfId) return;

        const dataConvertida = new Date(dataHora);
        const dataIso = Number.isNaN(dataConvertida.getTime())
            ? new Date().toISOString()
            : dataConvertida.toISOString();

        const numeroDb = numeroToDbValue(nota);
        const usuarioId = appState.currentUser && appState.currentUser.id
            ? String(appState.currentUser.id)
            : null;

        try {
            await supabaseRpc('registrar_bipagem_app_v2', {
                p_numero_nf: numeroDb,
                p_tipo: tipoNormalizado,
                p_usuario_id: usuarioId,
                p_carregamento_id: null,
                p_data_hora: dataIso,
                p_data_hora_manual: Boolean(dataHoraManual),
            });
            return;
        } catch (rpcError) {
            // Fallback para INSERT direto se RPC ainda não estiver criada no banco.
        }

        await supabaseRequest(`${supabaseConfig.tables.bipagens}`, {
            method: 'POST',
            body: {
                nf_id: nfId,
                tipo: tipoNormalizado,
                data_hora: dataIso,
                data_hora_manual: Boolean(dataHoraManual),
            },
        });
    } catch (error) {
        console.warn('[Supabase] Falha ao salvar bipagem:', error?.message || error);
    }
}

async function sincronizarSolicitacaoSupabase(solicitacao) {
    try {
        const payloadComSenha = {
            nome: String(solicitacao.nome || ''),
            email: String(solicitacao.email || '').toLowerCase(),
            senha: String(solicitacao.senha || ''),
            role_solicitado: String(solicitacao.papel || 'faturista'),
            status: String(solicitacao.status || 'pendente'),
        };

        const payloadSemSenha = {
            nome: String(solicitacao.nome || ''),
            email: String(solicitacao.email || '').toLowerCase(),
            role_solicitado: String(solicitacao.papel || 'faturista'),
            status: String(solicitacao.status || 'pendente'),
        };

        // Fluxo principal: tenta gravar também a senha da solicitação (quando a coluna existir).
        let insertedAtual = await supabaseRequest(`${supabaseConfig.tables.solicitacoes}?select=id,email`, {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: payloadComSenha,
        }).catch(() => null);

        if (!insertedAtual) {
            insertedAtual = await supabaseRequest(`${supabaseConfig.tables.solicitacoes}?select=id,email`, {
                method: 'POST',
                headers: { Prefer: 'return=representation' },
                body: payloadSemSenha,
            }).catch(() => null);
        }

        if (Array.isArray(insertedAtual) && insertedAtual[0] && insertedAtual[0].id) {
            solicitacao.id = insertedAtual[0].id;
            return true;
        }

        try {
            // Fallback legado: RPC antiga pode existir em alguns bancos.
            const rpcResult = await supabaseRpc('criar_solicitacao_acesso_app', {
                p_nome: String(solicitacao.nome || ''),
                p_email: String(solicitacao.email || '').toLowerCase(),
                p_senha: String(solicitacao.senha || ''),
                p_role_solicitado: String(solicitacao.papel || 'faturista'),
            });

            const rpcPayload = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
            if (rpcPayload && rpcPayload.id) {
                solicitacao.id = rpcPayload.id;
            }
            return true;
        } catch (rpcError) {
            // Fallback para inserção REST legada (com coluna senha), se existir.
        }

        const inserted = await supabaseRequest(`${supabaseConfig.tables.solicitacoes}?select=id,email`, {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: {
                nome: String(solicitacao.nome || ''),
                email: String(solicitacao.email || '').toLowerCase(),
                senha: String(solicitacao.senha || ''),
                role_solicitado: String(solicitacao.papel || 'faturista'),
                status: String(solicitacao.status || 'pendente'),
            },
        });

        if (Array.isArray(inserted) && inserted[0] && inserted[0].id) {
            solicitacao.id = inserted[0].id;
        }
        return true;
    } catch (error) {
        console.warn('[Supabase] Falha ao salvar solicitação:', error?.message || error);
        return false;
    }
}

async function atualizarStatusSolicitacaoSupabase(solicitacao) {
    try {
        const statusFinal = String(solicitacao.status || 'pendente').trim().toLowerCase();
        const emailFinal = String(solicitacao.email || '').toLowerCase().trim();

        // Prioriza RPC para contornar RLS quando a funcao server-side estiver disponivel.
        try {
            const rpcResult = await supabaseRpc('atualizar_status_solicitacao_app', {
                p_id: solicitacao.id ?? null,
                p_email: emailFinal || null,
                p_status: statusFinal,
            });
            const rpcPayload = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
            const updatedByRpc = Number(
                rpcPayload?.updated_rows ??
                rpcPayload?.affected_rows ??
                rpcPayload?.rows_affected ??
                (rpcPayload === true ? 1 : 0)
            );
            if (updatedByRpc > 0) {
                return true;
            }
        } catch (rpcError) {
            // Sem RPC: segue para fluxo REST atual.
        }

        if (solicitacao.id) {
            const porId = await supabaseRequest(
                `${supabaseConfig.tables.solicitacoes}?id=eq.${encodeURIComponent(solicitacao.id)}&select=id,status,email`,
                {
                    method: 'PATCH',
                    headers: { Prefer: 'return=representation' },
                    body: { status: statusFinal },
                }
            ).catch(() => []);

            // Mesmo quando atualiza por id, também atualiza duplicadas pendentes do mesmo email.
            if (emailFinal) {
                await supabaseRequest(
                    `${supabaseConfig.tables.solicitacoes}?email=eq.${encodeURIComponent(emailFinal)}&status=eq.pendente&select=id,status,email`,
                    {
                        method: 'PATCH',
                        headers: { Prefer: 'return=representation' },
                        body: { status: statusFinal },
                    }
                ).catch(() => null);
            }

            if (Array.isArray(porId) && porId.length > 0) {
                return true;
            }
        }

        const porEmail = await supabaseRequest(
            `${supabaseConfig.tables.solicitacoes}?email=eq.${encodeURIComponent(emailFinal)}&status=eq.pendente&select=id,status,email`,
            {
                method: 'PATCH',
                headers: { Prefer: 'return=representation' },
                body: { status: statusFinal },
            }
        ).catch(() => []);

        if (Array.isArray(porEmail) && porEmail.length > 0) {
            return true;
        }

        // Para aprovacao, evita apagar a solicitacao: ela funciona como trilha/auditoria e fallback de login.
        // Se nao conseguiu atualizar no banco, sinaliza falha para a tela nao recarregar estado pendente.
        if (statusFinal === 'aprovada') {
            return false;
        }

        // Fallback robusto: remove solicitações pendentes processadas quando UPDATE não é suportado no schema/policy atual.
        if (solicitacao.id) {
            await supabaseRequest(
                `${supabaseConfig.tables.solicitacoes}?id=eq.${encodeURIComponent(solicitacao.id)}&select=id,email`,
                {
                    method: 'DELETE',
                    headers: { Prefer: 'return=representation' },
                }
            ).catch(() => null);
        }

        if (emailFinal) {
            await supabaseRequest(
                `${supabaseConfig.tables.solicitacoes}?email=eq.${encodeURIComponent(emailFinal)}&status=eq.pendente&select=id,email`,
                {
                    method: 'DELETE',
                    headers: { Prefer: 'return=representation' },
                }
            ).catch(() => null);
        }

        return true;
    } catch (error) {
        console.warn('[Supabase] Falha ao atualizar status da solicitação:', error?.message || error);
        return false;
    }
}

async function sincronizarPerfilSupabase(usuario) {
    try {
        const email = String(usuario.email || '').toLowerCase();
        const nome = String(usuario.nome || '');

        try {
            await supabaseRpc('upsert_profile_app', {
                p_nome: nome,
                p_email: email,
                p_senha: String(usuario.senha || ''),
                p_role: String(usuario.papel || 'faturista'),
                p_ativo: usuario.status !== 'inativo',
            });
            return;
        } catch (rpcError) {
            // Fallback para update REST em profiles se RPC não existir.
        }

        const payload = {
            nome,
            email,
            senha: String(usuario.senha || ''),
            role: String(usuario.papel || 'faturista'),
            ativo: usuario.status !== 'inativo',
        };

        const existentes = await supabaseRequest(
            `${supabaseConfig.tables.perfis}?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`
        ).catch(() => []);

        if (Array.isArray(existentes) && existentes.length > 0) {
            await supabaseRequest(`${supabaseConfig.tables.perfis}?id=eq.${encodeURIComponent(existentes[0].id)}`, {
                method: 'PATCH',
                body: payload,
            });
            return;
        }

        // profiles normalmente depende de auth.users (id uuid obrigatório).
        // Se não existir perfil com esse email, não força insert para não quebrar o fluxo.
        console.warn('[Supabase] Perfil não encontrado para email; criação deve ser feita via Auth do Supabase:', email);
    } catch (error) {
        console.warn('[Supabase] Falha ao sincronizar perfil:', error?.message || error);
    }
}

function autenticarPerfilLocal(loginNormalizado, emailParaLogin, senha) {
    const senhaInformada = String(senha || '');

    const porEmailOuNome = appState.usuarios.find((u) => {
        const emailMatch = emailParaLogin && String(u.email || '').toLowerCase() === emailParaLogin;
        const nomeMatch = String(u.nome || '').toLowerCase() === loginNormalizado;
        return (emailMatch || nomeMatch) && String(u.senha || '') === senhaInformada;
    });

    if (!porEmailOuNome) {
        return { ok: false, pendente: false, usuario: null };
    }

    const pendente = String(porEmailOuNome.status || '').toLowerCase() !== 'ativo';
    return {
        ok: !pendente,
        pendente,
        usuario: porEmailOuNome,
    };
}

function autenticarSolicitacaoAprovada(loginNormalizado, emailParaLogin, senha) {
    const senhaInformada = String(senha || '');

    const solicitacaoAprovada = appState.solicitacoes.find((s) => {
        const statusAprovado = String(s.status || '').trim().toLowerCase() === 'aprovada';
        if (!statusAprovado) return false;

        const emailMatch = emailParaLogin && String(s.email || '').toLowerCase() === emailParaLogin;
        const nomeMatch = String(s.nome || '').toLowerCase() === loginNormalizado;
        if (!emailMatch && !nomeMatch) return false;

        const senhaSalva = String(s.senha || '');
        // Se a coluna senha nao estiver disponivel na solicitacao, trata a senha digitada como senha inicial.
        return !senhaSalva || senhaSalva === senhaInformada;
    });

    if (!solicitacaoAprovada) {
        return { ok: false, usuario: null };
    }

    return {
        ok: true,
        usuario: {
            id: solicitacaoAprovada.id || Math.floor(Math.random() * 1_000_000_000),
            nome: String(solicitacaoAprovada.nome || loginNormalizado || ''),
            email: String(solicitacaoAprovada.email || emailParaLogin || '').toLowerCase(),
            senha: senhaInformada,
            papel: String(solicitacaoAprovada.papel || 'faturista'),
            status: 'ativo',
        },
    };
}

async function buscarSolicitacaoAprovadaNoSupabase(loginNormalizado, emailParaLogin) {
    const email = String(emailParaLogin || '').toLowerCase().trim();
    const nome = String(loginNormalizado || '').toLowerCase().trim();

    try {
        if (email) {
            const porEmail = await supabaseRequest(
                `${supabaseConfig.tables.solicitacoes}?select=*&email=eq.${encodeURIComponent(email)}&status=eq.aprovada&order=id.desc&limit=1`
            ).catch(() => []);
            if (Array.isArray(porEmail) && porEmail.length > 0) {
                return mapSolicitacaoRowToLocal(porEmail[0]);
            }
        }

        if (nome) {
            const porNome = await supabaseRequest(
                `${supabaseConfig.tables.solicitacoes}?select=*&nome=eq.${encodeURIComponent(nome)}&status=eq.aprovada&order=id.desc&limit=1`
            ).catch(() => []);
            if (Array.isArray(porNome) && porNome.length > 0) {
                return mapSolicitacaoRowToLocal(porNome[0]);
            }

            // Fallback case-insensitive para variacoes de caixa no nome.
            const aprovadasRecentes = await supabaseRequest(
                `${supabaseConfig.tables.solicitacoes}?select=*&status=eq.aprovada&order=id.desc&limit=100`
            ).catch(() => []);
            if (Array.isArray(aprovadasRecentes) && aprovadasRecentes.length > 0) {
                const matchNome = aprovadasRecentes.find((row) =>
                    String(row.nome || '').trim().toLowerCase() === nome
                );
                if (matchNome) {
                    return mapSolicitacaoRowToLocal(matchNome);
                }
            }
        }
    } catch {
        return null;
    }

    return null;
}

async function definirPerfilPendenteDoSolicitante(authUser, nome, email, papel) {
    if (!authUser || !authUser.id) return;

    const perfil = await garantirPerfilPorAuth(authUser, nome);
    if (!perfil) return;

    await supabaseRequest(
        `${supabaseConfig.tables.perfis}?email=eq.${encodeURIComponent(String(email || '').toLowerCase())}`,
        {
            method: 'PATCH',
            body: {
                nome: String(nome || ''),
                role: String(papel || 'faturista'),
                ativo: false,
            },
        }
    ).catch(() => null);
}

async function garantirAuthDoAprovado(solicitacao) {
    const email = String(solicitacao.email || '').toLowerCase().trim();
    const senha = String(solicitacao.senha || '').trim();
    const nome = String(solicitacao.nome || '').trim();

    if (!email || !senha) {
        return;
    }

    try {
        await supabaseAuthSignIn(email, senha);
        await supabaseAuthSignOut();
        return;
    } catch {
        // usuário/senha não existem no Auth; tenta criar automaticamente.
    }

    try {
        await supabaseAuthSignUp(email, senha, nome);
        await supabaseAuthSignOut();
    } catch {
        // Se já existir ou houver limitação no Auth, segue para liberação de perfil.
    }
}

async function ativarPerfilAprovadoSupabase(solicitacao) {
    const email = String(solicitacao.email || '').toLowerCase();

    try {
        await supabaseRpc('ativar_perfil_aprovado_app', {
            p_nome: String(solicitacao.nome || ''),
            p_email: email,
            p_role: String(solicitacao.papel || 'faturista'),
        });
        return;
    } catch (rpcError) {
        // Sem RPC: usa REST.
    }

    await supabaseRequest(
        `${supabaseConfig.tables.perfis}?email=eq.${encodeURIComponent(email)}`,
        {
            method: 'PATCH',
            body: {
                nome: String(solicitacao.nome || ''),
                role: String(solicitacao.papel || 'faturista'),
                ativo: true,
            },
        }
    );
}

// Inicializar dados
async function inicializarDados() {
    appState.notasFiscais = [...dadosSimulados.notasFiscais];
    appState.usuarios = [];
    appState.solicitacoes = [];
    appState.bipagensFaturamento = [];
    appState.bipagensExpedicao = [];

    await carregarDadosSupabase();
}

// ========================================
// FUNÇÕES DE NAVEGAÇÃO
// ========================================

function irParaPagina(pagina, usuario = null) {
    appState.currentPage = pagina;
    if (usuario) appState.currentUser = usuario;
    renderizar();
}

async function fazerLogin(login, senha) {
    const loginNormalizado = String(login || '').trim().toLowerCase();
    const senhaNormalizada = String(senha || '');

    let emailParaLogin = loginNormalizado;
    if (!emailParaLogin.includes('@')) {
        const usuarioMapeado = appState.usuarios.find((u) => String(u.nome || '').toLowerCase() === loginNormalizado);
        emailParaLogin = usuarioMapeado ? String(usuarioMapeado.email || '').toLowerCase() : '';
    }

    await carregarDadosSupabase();
    const localAntes = autenticarPerfilLocal(loginNormalizado, emailParaLogin, senha);
    if (localAntes.ok && localAntes.usuario) {
        iniciarSincronizacaoAutomatica();
        irParaPagina('dashboard', { ...localAntes.usuario });
        return true;
    }
    if (localAntes.pendente) {
        alert('⏳ Seu acesso ainda está pendente de aprovação do admin.');
        return false;
    }

    try {
        if (!emailParaLogin || !emailParaLogin.includes('@')) {
            throw new Error('auth_email_invalido');
        }

        let sessao = null;
        try {
            sessao = await supabaseAuthSignIn(emailParaLogin, senhaNormalizada);
        } catch (signinError) {
            // Acesso aberto: se não existe no Auth, tenta criar automaticamente e logar.
            try {
                await supabaseAuthSignUp(emailParaLogin, senhaNormalizada, loginNormalizado);
            } catch (signupError) {
                // Ignora conflitos de usuário existente e tenta login novamente.
            }

            sessao = await supabaseAuthSignIn(emailParaLogin, senhaNormalizada);
        }

        await carregarDadosSupabase();
        const perfil = await garantirPerfilPorAuth(sessao.user, loginNormalizado);

        if (!perfil) {
            alert('❌ Não foi possível carregar seu perfil no banco.');
            await supabaseAuthSignOut();
            return false;
        }

        // Acesso automático: ativa perfil no primeiro login e guarda senha para fallback local.
        perfil.status = 'ativo';
        perfil.senha = senhaNormalizada;
        await sincronizarPerfilSupabase({
            nome: perfil.nome || loginNormalizado,
            email: perfil.email || emailParaLogin,
            senha: senhaNormalizada,
            papel: perfil.papel || 'conferente',
            status: 'ativo',
        });

        const idx = appState.usuarios.findIndex((u) => String(u.email || '').toLowerCase() === String(perfil.email || '').toLowerCase());
        if (idx >= 0) {
            appState.usuarios[idx] = { ...appState.usuarios[idx], ...perfil };
        } else {
            appState.usuarios.push({ ...perfil });
        }

        iniciarSincronizacaoAutomatica();
        irParaPagina('dashboard', { ...perfil });
        return true;
    } catch (error) {
        await carregarDadosSupabase();
        const localDepois = autenticarPerfilLocal(loginNormalizado, emailParaLogin, senhaNormalizada);
        if (localDepois.ok && localDepois.usuario) {
            iniciarSincronizacaoAutomatica();
            irParaPagina('dashboard', { ...localDepois.usuario });
            return true;
        }

        let aprovado = autenticarSolicitacaoAprovada(loginNormalizado, emailParaLogin, senhaNormalizada);
        if (!aprovado.ok) {
            const aprovadoSupabase = await buscarSolicitacaoAprovadaNoSupabase(loginNormalizado, emailParaLogin);
            if (aprovadoSupabase) {
                if (!emailParaLogin || !emailParaLogin.includes('@')) {
                    emailParaLogin = String(aprovadoSupabase.email || '').toLowerCase();
                }
                aprovado = autenticarSolicitacaoAprovada(
                    loginNormalizado,
                    String(aprovadoSupabase.email || emailParaLogin || '').toLowerCase(),
                    senhaNormalizada,
                );

                if (aprovado.ok && aprovado.usuario) {
                    aprovado.usuario.nome = aprovadoSupabase.nome || aprovado.usuario.nome;
                    aprovado.usuario.papel = aprovadoSupabase.papel || aprovado.usuario.papel;
                }
            }
        }

        if (aprovado.ok && aprovado.usuario) {
            const idx = appState.usuarios.findIndex((u) => String(u.email || '').toLowerCase() === String(aprovado.usuario.email || '').toLowerCase());
            if (idx >= 0) {
                appState.usuarios[idx] = { ...appState.usuarios[idx], ...aprovado.usuario };
            } else {
                appState.usuarios.push({ ...aprovado.usuario });
            }

            // Reforca sincronizacao para que os proximos logins funcionem mesmo sem fallback.
            await sincronizarPerfilSupabase(aprovado.usuario).catch(() => null);
            await garantirAuthDoAprovado({
                nome: aprovado.usuario.nome,
                email: aprovado.usuario.email,
                senha: senhaNormalizada,
                papel: aprovado.usuario.papel,
            }).catch(() => null);
            await carregarDadosSupabase().catch(() => null);

            iniciarSincronizacaoAutomatica();
            irParaPagina('dashboard', { ...aprovado.usuario });
            return true;
        }

        const solicitacaoPendente = appState.solicitacoes.find((s) =>
            s.status === 'pendente' && (String(s.email || '').toLowerCase() === emailParaLogin || String(s.nome || '').toLowerCase() === loginNormalizado)
        );

        if (solicitacaoPendente) {
            alert('⏳ Seu acesso ainda está pendente de aprovação do admin.');
            return false;
        }

        const erroAuth = String(error?.message || '').toLowerCase();
        if (erroAuth.includes('email not confirmed')) {
            alert('❌ Seu usuário foi criado no Auth, mas o email ainda não foi confirmado no Supabase.');
            return false;
        }
        if (erroAuth.includes('signups not allowed') || erroAuth.includes('signup is disabled')) {
            alert('❌ O Supabase Auth está com cadastro por email desativado. Ative Email/Password em Authentication > Providers.');
            return false;
        }

        alert('❌ Login inválido ou usuário sem cadastro no Auth.');
        return false;
    }
}

async function fazerLogout() {
    pararSincronizacaoAutomatica();
    await supabaseAuthSignOut();
    appState.currentUser = null;
    appState.currentPage = 'login';
    renderizar();
}

function abrirConfiguracao() {
    if (!appState.currentUser) {
        alert('❌ Faça login para acessar as configurações.');
        return;
    }
    appState.currentPage = 'configuracao';
    renderizar();
}

async function alterarSenhaUsuario(senhaAtual, novaSenha, confirmarSenha) {
    const usuarioAtual = appState.currentUser;

    if (!usuarioAtual) {
        alert('❌ Usuário não autenticado.');
        return false;
    }

    if (novaSenha.length < 4) {
        alert('❌ A nova senha deve ter pelo menos 4 caracteres.');
        return false;
    }

    if (novaSenha !== confirmarSenha) {
        alert('❌ A confirmação da nova senha não confere.');
        return false;
    }

    try {
        await supabaseAuthSignIn(String(usuarioAtual.email || '').toLowerCase(), senhaAtual);
        await supabaseAuthRequest('user', {
            method: 'PUT',
            accessToken: appState.auth.accessToken,
            body: { password: novaSenha },
        });

        alert('✅ Senha alterada com sucesso!');
        return true;
    } catch (error) {
        alert('❌ Não foi possível alterar a senha. Verifique a senha atual.');
        return false;
    }
}

// ========================================
// FUNÇÕES DE BIPAGEM
// ========================================

function normalizarEntradaCodigo(valor) {
    return String(valor || '').trim().replace(/\s+/g, '');
}

function extrairNumeroNF(codigoLido) {
    const valor = normalizarEntradaCodigo(codigoLido);
    if (!valor) return '';

    // Se vier com aspas, usa exatamente o trecho entre aspas.
    const entreAspas = valor.match(/"(\d{3,10})"/);
    if (entreAspas) return entreAspas[1];

    // Se vier somente dígitos em leitura bruta da chave NFe (44 dígitos),
    // usa o bloco nNF (posições 26 a 34) e remove zeros à esquerda.
    const somenteDigitos = valor.replace(/\D/g, '');
    if (somenteDigitos.length === 44) {
        const blocoNNF = somenteDigitos.slice(25, 34);
        const numeroSemZeros = blocoNNF.replace(/^0+/, '');
        return numeroSemZeros || '0';
    }

    // Se a leitura vier com lixo antes/depois, tenta achar uma chave de 44 dígitos.
    const chave44 = somenteDigitos.match(/\d{44}/);
    if (chave44) {
        const blocoNNF = chave44[0].slice(25, 34);
        const numeroSemZeros = blocoNNF.replace(/^0+/, '');
        return numeroSemZeros || '0';
    }

    // Entrada manual curta ou texto com prefixo (ex: NF-001).
    if (/^\d{3,10}$/.test(somenteDigitos)) return somenteDigitos;
    const trechoNumerico = valor.match(/(\d{3,10})(?!.*\d)/);
    return trechoNumerico ? trechoNumerico[1] : valor;
}

function criarNotaAPartirDaLeitura(numeroNFExtraido) {
    const hoje = new Date().toISOString().slice(0, 10);
    const novaNota = {
        id: Math.floor(Math.random() * 1_000_000_000),
        numero: numeroNFExtraido,
        serie: '1',
        cliente: 'Cliente não informado',
        transportadora: 'Não informada',
        artigo: '-',
        pedido: '-',
        quantidadeItens: 0,
        metros: 0,
        pesoBruto: 0,
        valor: '0.00',
        status: 'pendente',
        dataEmissao: hoje,
    };
    appState.notasFiscais.push(novaNota);
    return novaNota;
}

function aplicarDadosXMLNaNota(nota, dadosXML) {
    if (!nota || !dadosXML) return;

    nota.cliente = dadosXML.cliente || nota.cliente || 'Cliente não informado';
    nota.transportadora = dadosXML.transportadora || nota.transportadora || 'Não informada';
    nota.artigo = dadosXML.artigo || nota.artigo || '-';
    nota.pedido = dadosXML.pedido || nota.pedido || '-';
    nota.quantidadeItens = Number(dadosXML.quantidadeItens ?? nota.quantidadeItens ?? 0);
    nota.metros = Number(dadosXML.metros ?? nota.metros ?? 0);
    nota.pesoBruto = Number(dadosXML.pesoBruto ?? nota.pesoBruto ?? 0);

    if (dadosXML.valorTotal !== undefined && dadosXML.valorTotal !== null && dadosXML.valorTotal !== '') {
        const valorNum = Number(dadosXML.valorTotal);
        if (!Number.isNaN(valorNum)) {
            nota.valor = valorNum.toFixed(2);
        }
    }

    if (dadosXML.dataEmissao) {
        nota.dataEmissao = dadosXML.dataEmissao;
    }
}

async function buscarDadosNFNoSupabase(numeroNF) {
    try {
        const numeroNormalizado = String(numeroNF || '').replace(/\D/g, '');
        if (!numeroNormalizado) return null;

        const rows = await supabaseRequest(
            `${supabaseConfig.tables.nfs}?select=*&numero_nf=eq.${encodeURIComponent(numeroNormalizado)}&limit=1`
        ).catch(() => []);

        if (!Array.isArray(rows) || rows.length === 0) {
            return null;
        }

        const row = rows[0];
        return {
            encontrada: true,
            numeroNF: row.numero_nf,
            cliente: row.cliente,
            transportadora: row.transportadora,
            artigo: row.artigo,
            pedido: row.pedido,
            quantidadeItens: row.quantidade_itens,
            metros: row.metros,
            pesoBruto: row.peso_bruto,
            valorTotal: row.valor_total,
            dataEmissao: row.data_emissao,
        };
    } catch (error) {
        console.warn('[Supabase] Falha ao buscar NF por numero:', error?.message || error);
        return null;
    }
}

async function buscarDadosNFNoXML(numeroNF) {
    const endpoints = Array.isArray(appState.xmlApiBaseUrls) && appState.xmlApiBaseUrls.length > 0
        ? appState.xmlApiBaseUrls
        : ['http://127.0.0.1:8787'];

    for (const baseUrl of endpoints) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);

        try {
            const response = await fetch(`${baseUrl}/api/nf/${encodeURIComponent(numeroNF)}`, {
                method: 'GET',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.status === 404) {
                appState.xmlServiceStatus.indisponivel = false;
                return null;
            }

            if (!response.ok) {
                continue;
            }

            const payload = await response.json();
            appState.xmlServiceStatus.indisponivel = false;
            return payload;
        } catch (error) {
            clearTimeout(timeoutId);
            continue;
        }
    }

    appState.xmlServiceStatus.indisponivel = true;
    const agora = Date.now();
    if (!appState.xmlServiceStatus.avisoConsoleEmitido || (agora - appState.xmlServiceStatus.ultimoAviso > 120000)) {
        appState.xmlServiceStatus.ultimoAviso = agora;
        appState.xmlServiceStatus.avisoConsoleEmitido = true;
        console.warn('[XML] Serviço indisponível. Bipagem segue sem enriquecimento automático.');
    }

    return null;
}

function buscarNotaPorCodigo(codigoLido) {
    const numeroExtraido = extrairNumeroNF(codigoLido);
    if (!numeroExtraido) return null;

    const nota = appState.notasFiscais.find(nf => {
        const numeroBancoExtraido = extrairNumeroNF(nf.numero);
        const numeroBancoNormalizado = normalizarEntradaCodigo(nf.numero);
        return numeroBancoExtraido === numeroExtraido || numeroBancoNormalizado === numeroExtraido;
    });

    if (!nota) return null;
    return { nota, numeroExtraido };
}

function agendarBipagemAutomatica(tipo) {
    const inputId = tipo === 'faturamento' ? 'codigoBarras' : 'codigoBarrasExp';
    const input = document.getElementById(inputId);
    if (!input) return;

    const codigo = normalizarEntradaCodigo(input.value);
    if (codigo.length < 20) return;

    if (appState.scanTimers[tipo]) {
        clearTimeout(appState.scanTimers[tipo]);
    }

    // Leitor normalmente envia a leitura toda de uma vez; aguardamos um curto intervalo e bipamos.
    appState.scanTimers[tipo] = setTimeout(() => {
        if (tipo === 'faturamento') {
            handleBiparFaturamento();
        } else {
            handleBiparExpedicao();
        }
    }, 120);
}

function biparNota(numeroNF, dataHora, dataHoraManual, tipo) {
    const tipoNormalizado = normalizarTipoBipagem(tipo);
    const resultadoBusca = buscarNotaPorCodigo(numeroNF);
    let nota = resultadoBusca ? resultadoBusca.nota : null;
    const numeroNFExtraido = resultadoBusca ? resultadoBusca.numeroExtraido : extrairNumeroNF(numeroNF);

    if (!nota && tipoNormalizado === 'faturamento' && numeroNFExtraido) {
        // No faturamento, se a NF ainda não existe no cadastro, cria automaticamente
        // para manter o mesmo número disponível no admin e na expedição.
        nota = criarNotaAPartirDaLeitura(numeroNFExtraido);
    }
    
    if (!nota) {
        alert('❌ Nota fiscal não encontrada! Faça o faturamento antes da expedição.');
        return false;
    }

    const listaBipagens = tipoNormalizado === 'faturamento' ? appState.bipagensFaturamento : appState.bipagensExpedicao;
    const ultimaBipagem = listaBipagens.length > 0 ? listaBipagens[listaBipagens.length - 1] : null;

    if (ultimaBipagem && ultimaBipagem.numeroNF === numeroNFExtraido) {
        alert('❌ NF já foi bipada na leitura anterior. Bipagem duplicada consecutiva não permitida.');
        return false;
    }

    const bipagem = {
        id: Math.random(),
        notaFiscalId: nota.id,
        numeroNF: numeroNFExtraido,
        cliente: nota.cliente,
        transportadora: nota.transportadora || 'Não informada',
        artigo: nota.artigo || '-',
        pedido: nota.pedido || '-',
        quantidadeItens: Number(nota.quantidadeItens || 0),
        metros: Number(nota.metros || 0),
        pesoBruto: Number(nota.pesoBruto || 0),
        valor: nota.valor,
        dataHora: dataHora,
        dataHoraManual: dataHoraManual,
        criadoEm: new Date().toLocaleString('pt-BR')
    };

    if (tipoNormalizado === 'faturamento') {
        appState.bipagensFaturamento.push(bipagem);
        nota.status = 'faturada';
        void sincronizarNfSupabase(nota);
        void sincronizarBipagemSupabase(nota, 'faturamento', dataHora, dataHoraManual);
        alert('✅ Nota fiscal faturada com sucesso!');
    } else if (tipoNormalizado === 'expedicao') {
        appState.bipagensExpedicao.push(bipagem);
        nota.status = 'expedida';
        void sincronizarNfSupabase(nota);
        void sincronizarBipagemSupabase(nota, 'expedicao', dataHora, dataHoraManual);
        alert('✅ Nota fiscal expedida com sucesso!');
    }

    return true;
}

// ========================================
// FUNÇÕES DE ADMINISTRAÇÃO
// ========================================

async function aprovarSolicitacao(id) {
    const solicitacao = appState.solicitacoes.find(s => String(s.id) === String(id));
    if (solicitacao) {
        const statusOriginal = solicitacao.status;
        solicitacao.status = 'aprovada';
        const emailNormalizado = String(solicitacao.email || '').toLowerCase().trim();

        try {
            await garantirAuthDoAprovado(solicitacao);
            const statusAtualizado = await atualizarStatusSolicitacaoSupabase(solicitacao);
            if (!statusAtualizado) {
                throw new Error('status_nao_atualizado_no_banco');
            }
            await ativarPerfilAprovadoSupabase(solicitacao);

            // Remove somente apos confirmacao no banco.
            appState.solicitacoes = appState.solicitacoes.filter(s => {
                const mesmoEmailPendente = String(s.email || '').toLowerCase().trim() === emailNormalizado
                    && String(s.status || '').trim().toLowerCase() === 'pendente';
                return !mesmoEmailPendente;
            });

            await carregarDadosSupabase();
            alert('✅ Solicitação aprovada!');
        } catch (error) {
            solicitacao.status = statusOriginal;
            console.warn('[Supabase] Falha ao ativar perfil aprovado:', error?.message || error);
            alert('⚠️ Solicitação aprovada localmente, mas o banco não confirmou a mudança. Verifique a policy de UPDATE em solicitacoes_acesso.');
        }
        renderizar();
    }
}

async function rejeitarSolicitacao(id) {
    const solicitacao = appState.solicitacoes.find(s => String(s.id) === String(id));
    if (solicitacao) {
        const statusOriginal = solicitacao.status;
        solicitacao.status = 'rejeitada';
        const emailNormalizado = String(solicitacao.email || '').toLowerCase().trim();
        const statusAtualizado = await atualizarStatusSolicitacaoSupabase(solicitacao);
        if (statusAtualizado) {
            appState.solicitacoes = appState.solicitacoes.filter(s => {
                const mesmoId = String(s.id) === String(id);
                const mesmoEmailPendente = String(s.email || '').toLowerCase().trim() === emailNormalizado
                    && String(s.status || '').trim().toLowerCase() === 'pendente';
                return !(mesmoId || mesmoEmailPendente);
            });
            alert('❌ Solicitação rejeitada!');
        } else {
            solicitacao.status = statusOriginal;
            alert('⚠️ Rejeição aplicada localmente, mas o banco não confirmou a mudança.');
        }
        renderizar();
    }
}

async function criarSolicitacao(nome, email, senha, papel) {
    const emailNormalizado = email.trim().toLowerCase();
    const nomeNormalizado = nome.trim().toLowerCase();

    const usuarioExistente = appState.usuarios.find(u =>
        u.email.toLowerCase() === emailNormalizado || u.nome.toLowerCase() === nomeNormalizado
    );

    if (usuarioExistente) {
        alert('❌ Já existe usuário com este nome ou email.');
        return;
    }

    const solicitacaoExistente = appState.solicitacoes.find(s =>
        s.status === 'pendente' && (s.email.toLowerCase() === emailNormalizado || s.nome.toLowerCase() === nomeNormalizado)
    );

    if (solicitacaoExistente) {
        alert('⏳ Já existe uma solicitação pendente para este nome ou email.');
        return;
    }

    const novaSolicitacao = {
        id: Math.random(),
        nome: nome.trim(),
        email: emailNormalizado,
        senha: senha,
        papel: papel,
        status: 'pendente'
    };

    let signupResult = null;
    let sessaoTemporariaAtiva = false;
    let signupFalhou = false;
    try {
        signupResult = await supabaseAuthSignUp(emailNormalizado, senha, nome.trim());
    } catch (error) {
        const msg = String(error?.message || '').toLowerCase();
        const usuarioJaExiste = msg.includes('already') || msg.includes('exists') || msg.includes('registered');
        signupFalhou = !usuarioJaExiste;
    }

    if (signupResult && signupResult.user && signupResult.access_token) {
        try {
            setAuthSession(signupResult);
            sessaoTemporariaAtiva = true;
            await definirPerfilPendenteDoSolicitante(signupResult.user, nome.trim(), emailNormalizado, papel);
        } catch (error) {
            console.warn('[Supabase] Falha ao registrar perfil pendente na solicitação:', error?.message || error);
        }
    } else {
        try {
            await supabaseAuthSignIn(emailNormalizado, senha);
            sessaoTemporariaAtiva = true;
            if (appState.auth.user) {
                await definirPerfilPendenteDoSolicitante(appState.auth.user, nome.trim(), emailNormalizado, papel);
            }
        } catch (error) {
            // Pode falhar se confirmação de email estiver obrigatória.
            console.warn('[Supabase] Não foi possível abrir sessão temporária para solicitação:', error?.message || error);
        }
    }

    const solicitacaoSalva = await sincronizarSolicitacaoSupabase(novaSolicitacao);
    if (sessaoTemporariaAtiva) {
        await supabaseAuthSignOut();
    }

    if (!solicitacaoSalva) {
        alert('❌ Não foi possível gravar a solicitação no banco. Verifique a policy de insert em solicitacoes_acesso.');
        return;
    }

    // Mantém senha/role no perfil para permitir login via perfil mesmo quando Auth estiver indisponível.
    await sincronizarPerfilSupabase({
        nome: nome.trim(),
        email: emailNormalizado,
        senha: String(senha || ''),
        papel,
        status: 'inativo',
    });

    appState.solicitacoes.push(novaSolicitacao);
    if (signupFalhou) {
        alert('✅ Solicitação enviada para aprovação do admin. Observação: o Auth bloqueou criação automática e o admin deve liberar/criar o usuário.');
    } else {
        alert('✅ Solicitação enviada com sucesso!');
    }
    irParaPagina('login');
}

function exportarPlanilha(tipo) {
    let dados = [];
    let nomeArquivo = '';

    if (tipo === 'notasFiscais') {
        dados = appState.notasFiscais;
        nomeArquivo = 'notas_fiscais.csv';
    } else if (tipo === 'faturamento') {
        dados = appState.bipagensFaturamento;
        nomeArquivo = 'faturamento.csv';
    } else if (tipo === 'expedicao') {
        dados = appState.bipagensExpedicao;
        nomeArquivo = 'expedicao.csv';
    }

    if (dados.length === 0) {
        alert('Nenhum dado para exportar!');
        return;
    }

    const headers = Object.keys(dados[0]);
    let csv = headers.join(',') + '\n';
    dados.forEach(linha => {
        csv += headers.map(h => `"${linha[h]}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    link.click();

    alert('✅ Planilha exportada com sucesso!');
}

async function gerarRelatorioExpedicaoExcel() {
    if (appState.bipagensExpedicao.length === 0) {
        alert('❌ Nenhuma expedição registrada para gerar relatório!');
        return;
    }

    const numeroFormatter = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const toNumber = (valor) => {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    };

    const formatNumero = (valor) => numeroFormatter.format(toNumber(valor));

    const normalizarNumeroNf = (valor) => String(valor || '').replace(/\D/g, '') || String(valor || '');

    const derivarRes = (pedido) => {
        const digitos = String(pedido || '').replace(/\D/g, '');
        if (!digitos) return '';
        return digitos.slice(-3);
    };

    // Enriquecimento com XML/Supabase para garantir o maximo de campos no layout final.
    for (const bipagem of appState.bipagensExpedicao) {
        const numeroNf = normalizarNumeroNf(bipagem.numeroNF);
        if (!numeroNf) continue;

        const precisaEnriquecer = !bipagem.artigo || !bipagem.pedido || !bipagem.transportadora || !toNumber(bipagem.pesoBruto) || !toNumber(bipagem.metros);
        if (!precisaEnriquecer) continue;

        let dadosNf = await buscarDadosNFNoSupabase(numeroNf);
        if (!dadosNf) {
            dadosNf = await buscarDadosNFNoXML(numeroNf);
        }

        if (!dadosNf || !dadosNf.encontrada) continue;

        bipagem.artigo = dadosNf.artigo || bipagem.artigo || '-';
        bipagem.pedido = dadosNf.pedido || bipagem.pedido || '-';
        bipagem.transportadora = dadosNf.transportadora || bipagem.transportadora || '';
        bipagem.quantidadeItens = Number(dadosNf.quantidadeItens ?? bipagem.quantidadeItens ?? 0);
        bipagem.metros = Number(dadosNf.metros ?? bipagem.metros ?? 0);
        bipagem.pesoBruto = Number(dadosNf.pesoBruto ?? bipagem.pesoBruto ?? 0);
        bipagem.cliente = dadosNf.cliente || bipagem.cliente || '';
    }

    const linhasDados = appState.bipagensExpedicao.map((b) => {
        const transportadora = String(b.transportadora || '').trim();
        const pedido = String(b.pedido || '-');
        return {
            artigo: String(b.artigo || '-'),
            pedido,
            pesoBruto: toNumber(b.pesoBruto),
            metros: toNumber(b.metros),
            pcs: toNumber(b.quantidadeItens),
            cliente: String(b.cliente || '-'),
            nf: String(b.numeroNF || ''),
            res: derivarRes(pedido),
            transp: transportadora,
        };
    });

    const transportadoras = Array.from(new Set(linhasDados.map((l) => l.transp).filter(Boolean)));
    const transportadoraCabecalho = transportadoras.length === 1
        ? transportadoras[0]
        : transportadoras.length > 1
            ? 'TRANSPORTADORAS DIVERSAS'
            : 'NÃO INFORMADA';

    const totalPeso = linhasDados.reduce((acc, l) => acc + l.pesoBruto, 0);
    const totalMetros = linhasDados.reduce((acc, l) => acc + l.metros, 0);
    const totalPcs = linhasDados.reduce((acc, l) => acc + l.pcs, 0);

    const agora = new Date();
    const data = agora.toLocaleDateString('pt-BR');
    const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const escapeHtml = (valor) => String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const linhasHtml = linhasDados.map((l) => `
        <tr>
            <td class="left">${escapeHtml(l.artigo)}</td>
            <td class="center">${escapeHtml(l.pedido)}</td>
            <td class="right">${escapeHtml(formatNumero(l.pesoBruto))}</td>
            <td class="right">${escapeHtml(formatNumero(l.metros))}</td>
            <td class="right">${escapeHtml(formatNumero(l.pcs))}</td>
            <td class="left">${escapeHtml(l.cliente)}</td>
            <td class="center">${escapeHtml(l.nf)}</td>
            <td class="center">${escapeHtml(l.res)}</td>
            <td class="left">${escapeHtml(l.transp)}</td>
        </tr>
    `).join('');

    const htmlExcel = `
<html>
<head>
    <meta charset="UTF-8" />
    <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
        td, th { border: 1px solid #000; padding: 4px 6px; font-size: 13px; }
        .brand { font-size: 28px; font-weight: 700; color: #0d47a1; }
        .title { font-size: 36px; font-weight: 700; color: #d50000; text-align: center; }
        .subtitle { font-size: 36px; font-weight: 700; color: #d50000; text-align: center; }
        .header { font-size: 20px; font-weight: 700; text-align: center; }
        .center { text-align: center; }
        .right { text-align: right; }
        .left { text-align: left; }
        .total { font-weight: 700; }
        .metaLabel { font-weight: 700; text-align: center; background: #dbe7f3; }
        .metaValue { font-weight: 700; text-align: center; background: #dbe7f3; }
        .footerLabel { font-size: 34px; font-weight: 700; }
    </style>
</head>
<body>
    <table>
        <tr>
            <td colspan="7" class="brand">capricórnio</td>
            <td class="metaLabel">DATA:</td>
            <td class="metaValue">${escapeHtml(data)} HORA: ${escapeHtml(hora)}</td>
        </tr>
        <tr>
            <td colspan="9" class="title">CONTROLE DE CARREGAMENTO</td>
        </tr>
        <tr>
            <td colspan="9" class="subtitle">${escapeHtml(transportadoraCabecalho).toUpperCase()}</td>
        </tr>
        <tr>
            <th class="header">ARTIGO</th>
            <th class="header">PEDIDO</th>
            <th class="header">P BRUTO</th>
            <th class="header">METROS</th>
            <th class="header">PÇS</th>
            <th class="header">CLIENTE</th>
            <th class="header">NF</th>
            <th class="header">RES</th>
            <th class="header">TRANSP</th>
        </tr>
        ${linhasHtml}
        <tr class="total">
            <td colspan="2" class="center">TOTAL</td>
            <td class="right">${escapeHtml(formatNumero(totalPeso))}</td>
            <td class="right">${escapeHtml(formatNumero(totalMetros))}</td>
            <td class="right">${escapeHtml(formatNumero(totalPcs))}</td>
            <td colspan="4"></td>
        </tr>
        <tr>
            <td colspan="3" class="footerLabel">PLACA ________________</td>
            <td colspan="6" class="footerLabel">CONFERENTE ____________________________</td>
        </tr>
        <tr>
            <td colspan="5" class="footerLabel">ASSINATURA DO CONFERENTE ____________________________</td>
            <td colspan="4"></td>
        </tr>
        <tr>
            <td colspan="5" class="footerLabel">ASSINATURA DO MOTORISTA ____________________________</td>
            <td colspan="4" class="footerLabel">DOC RG ____________________</td>
        </tr>
    </table>
</body>
</html>`;

    const blob = new Blob(['\uFEFF', htmlExcel], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `controle_carregamento_${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();

    alert('✅ Download do relatório Excel iniciado!');
}

// ========================================
// FUNÇÕES DE RELATÓRIO DE EXPEDIÇÃO
// ========================================

function gerarRelatorioExpedicao() {
    if (appState.bipagensExpedicao.length === 0) {
        alert('❌ Nenhuma expedição registrada para gerar relatório!');
        return;
    }

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const totalNotas = appState.bipagensExpedicao.length;
    const valorTotal = appState.bipagensExpedicao.reduce((total, b) => total + parseFloat(b.valor), 0);

    let relatorio = `CAPRICÓRNIO TÊXTIL S.A
CONTROLE DE EXPEDIÇÃO
═════════════════════════════════════════════════════════════════════

DATA: ${dataAtual}                                 CONFERENTE: ${appState.currentUser.nome}

═════════════════════════════════════════════════════════════════════
 NF      │ CLIENTE                      │ VALOR         │ DATA/HORA
═════════════════════════════════════════════════════════════════════
`;

    appState.bipagensExpedicao.forEach((bipagem) => {
        relatorio += `${bipagem.numeroNF.padEnd(7)} │ ${bipagem.cliente.substring(0, 28).padEnd(28)} │ R$ ${bipagem.valor.padEnd(9)} │ ${bipagem.criadoEm}
`;
    });

    relatorio += `═════════════════════════════════════════════════════════════════════
TOTAL: ${totalNotas} notas                                    R$ ${valorTotal.toFixed(2)}
═════════════════════════════════════════════════════════════════════

PLACA: ________________

CONFERENTE: ____________________     DATA: ${dataAtual}

MOTORISTA: ____________________

═════════════════════════════════════════════════════════════════════
Documento gerado em ${new Date().toLocaleString('pt-BR')}
`;

    const blob = new Blob([relatorio], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_expedicao_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();

    alert('✅ Relatório gerado e baixado com sucesso!');
}

function gerarRelatorioExpedicaoPDF() {
    if (appState.bipagensExpedicao.length === 0) {
        alert('❌ Nenhuma expedição registrada para gerar relatório!');
        return;
    }

    const transportadora = prompt('Informe o nome da transportadora:');
    if (transportadora === null) {
        return;
    }

    const transportadoraFinal = transportadora.trim();
    if (!transportadoraFinal) {
        alert('❌ O nome da transportadora é obrigatório para gerar o PDF.');
        return;
    }

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR');
    const totalNotas = appState.bipagensExpedicao.length;
    const totalPcs = appState.bipagensExpedicao.reduce((acc, item) => acc + Number(item.quantidadeItens || 0), 0);
    const totalPesoBruto = appState.bipagensExpedicao.reduce((acc, item) => acc + Number(item.pesoBruto || 0), 0);
    const totalMetros = appState.bipagensExpedicao.reduce((acc, item) => acc + Number(item.metros || 0), 0);

    const formatNumero = (valor) => Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });

    const escapeHtml = (valor) => String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    let conteudoHTML = `
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    color: #000;
                }
                .sheet {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                .sheet td, .sheet th {
                    border: 1px solid #000;
                    padding: 4px 6px;
                    font-size: 12px;
                    vertical-align: middle;
                }
                .logo {
                    font-size: 42px;
                    font-weight: 700;
                    color: #1f4da8;
                    text-align: left;
                }
                .titulo {
                    text-align: center;
                    color: #d60000;
                    font-weight: 700;
                    font-size: 30px;
                    letter-spacing: 1px;
                }
                .subtitulo {
                    text-align: center;
                    color: #d60000;
                    font-weight: bold;
                    font-size: 20px;
                }
                .label {
                    font-weight: bold;
                }
                .th {
                    text-align: center;
                    font-size: 16px;
                    font-weight: 700;
                }
                .center {
                    text-align: center;
                }
                .nf {
                    background: #fff45a;
                    font-weight: 700;
                    text-align: center;
                }
                .total {
                    font-weight: bold;
                }
                @media print {
                    @page { size: landscape; margin: 8mm; }
                }
            </style>
        </head>
        <body>
            <table class="sheet">
                <tr>
                    <td colspan="3" class="logo">capricornio</td>
                    <td colspan="5"></td>
                    <td colspan="2" class="label center">DATA:</td>
                </tr>
                <tr>
                    <td colspan="8"></td>
                    <td colspan="2" class="label center">${dataAtual} HRS ${horaAtual}</td>
                </tr>
                <tr>
                    <td colspan="10" class="titulo">CONTROLE DE CARREGAMENTO</td>
                </tr>
                <tr>
                    <td colspan="10" class="subtitulo">${escapeHtml(transportadoraFinal).toUpperCase()}</td>
                </tr>
                <tr>
                    <th class="th">ARTIGO</th>
                    <th class="th">PEDIDO</th>
                    <th class="th">P BRUTO</th>
                    <th class="th">METROS</th>
                    <th class="th">PCS</th>
                    <th class="th" colspan="3">CLIENTE</th>
                    <th class="th">NF</th>
                    <th class="th">RES</th>
                    <th class="th">TRANSP</th>
                </tr>
                ${appState.bipagensExpedicao.map((bipagem) => `
                    <tr>
                        <td class="center">${escapeHtml(bipagem.artigo || '-')}</td>
                        <td class="center">${escapeHtml(bipagem.pedido || '-')}</td>
                        <td class="center">${escapeHtml(formatNumero(bipagem.pesoBruto || 0))}</td>
                        <td class="center">${escapeHtml(formatNumero(bipagem.metros || 0))}</td>
                        <td class="center">${escapeHtml(formatNumero(bipagem.quantidadeItens || 0))}</td>
                        <td colspan="3">${escapeHtml(bipagem.cliente || '-')}</td>
                        <td class="nf">${escapeHtml(bipagem.numeroNF)}</td>
                        <td class="center">${escapeHtml(bipagem.pedido || '-')}</td>
                        <td class="center">${escapeHtml(bipagem.transportadora || transportadoraFinal)}</td>
                    </tr>
                `).join('')}
                <tr class="total">
                    <td colspan="4" class="center">TOTAL</td>
                    <td class="center">${escapeHtml(formatNumero(totalPcs))}</td>
                    <td colspan="2"></td>
                    <td class="center">${escapeHtml(String(totalNotas))}</td>
                    <td class="center">${escapeHtml(formatNumero(totalPesoBruto))}</td>
                    <td class="center">${escapeHtml(transportadoraFinal)}</td>
                </tr>
                <tr>
                    <td colspan="4" class="label">PLACA ____________________________</td>
                    <td colspan="6" class="label">CONFERENTE ${escapeHtml(appState.currentUser.nome || '')}</td>
                </tr>
                <tr>
                    <td colspan="5" class="label">ASSINATURA DO CONFERENTE ______________________________</td>
                    <td colspan="5" class="label">DOC RG ____________________</td>
                </tr>
                <tr>
                    <td colspan="10" class="label">ASSINATURA DO MOTORISTA ______________________________</td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const janela = window.open('', '', 'width=1000,height=700');
    janela.document.write(conteudoHTML);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 500);
}

function abrirModalRelatorioExpedicao() {
    appState.currentPage = 'relatorio-expedicao';
    renderizar();
}

function renderizarRelatorioExpedicao() {
    return `
        <div class="dashboard-container">
            <div class="dashboard-content">
                <button class="back-button" onclick="irParaPagina('dashboard', appState.currentUser)">
                    ← Voltar
                </button>

                <h1 class="dashboard-title">Gerar Relatório de Expedição</h1>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">Total de expedições: ${appState.bipagensExpedicao.length}</p>

                <div class="cards-grid">
                    <div class="card" style="cursor: pointer;" onclick="gerarRelatorioExpedicao()">
                        <div class="card-icon">📄</div>
                        <h3 class="card-title">Relatório em Texto</h3>
                        <p class="card-description">Baixar relatório em formato TXT</p>
                    </div>

                    <div class="card" style="cursor: pointer;" onclick="gerarRelatorioExpedicaoPDF()">
                        <div class="card-icon">📋</div>
                        <h3 class="card-title">Relatório para Impressão</h3>
                        <p class="card-description">Visualizar e imprimir relatório</p>
                    </div>
                </div>

                <div class="bipagem-card" style="margin-top: 30px;">
                    <h3 style="color: var(--text-primary); margin-bottom: 16px;">Resumo das Expedições</h3>
                    
                    ${appState.bipagensExpedicao.length === 0 ? 
                        '<p style="color: var(--text-secondary);">Nenhuma expedição registrada</p>' :
                        `
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>NF</th>
                                        <th>Cliente</th>
                                        <th>Valor</th>
                                        <th>Data/Hora</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${appState.bipagensExpedicao.map(b => `
                                        <tr>
                                            <td>${b.numeroNF}</td>
                                            <td>${b.cliente}</td>
                                            <td>R$ ${b.valor}</td>
                                            <td>${b.criadoEm}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        `
                    }
                </div>
            </div>
        </div>
    `;
}

// ========================================
// RENDERIZAÇÃO - PÁGINA DE LOGIN
// ========================================

function renderizarLogin() {
    return `
        <div class="login-container">
            <div class="login-card">
                <div class="login-header">
                    <div class="login-icon">📋</div>
                    <h1 class="login-title">System</h1>
                    <p class="login-subtitle">Sistema de Gestão de Faturamento e Expedição</p>
                </div>

                <div class="login-divider"></div>

                <form onsubmit="handleLogin(event)">
                    <div class="form-group">
                        <label class="form-label">Nome ou Email</label>
                        <input type="text" class="form-input" id="loginUsuario" placeholder="Digite seu nome ou email" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Senha</label>
                        <input type="password" class="form-input" id="loginSenha" placeholder="Digite sua senha" required>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        🔐 Entrar
                    </button>
                </form>

                <div class="login-buttons" style="margin-top: 12px;">
                    <button type="button" class="btn btn-secondary" onclick="irParaPagina('solicitar-acesso')">
                        📝 Solicitar Acesso
                    </button>
                </div>

                <div class="login-footer">
                    🔒 Acesso seguro. Seus dados estão protegidos.
                </div>
            </div>
        </div>
    `;
}

async function handleLogin(event) {
    event.preventDefault();
    const login = document.getElementById('loginUsuario').value;
    const senha = document.getElementById('loginSenha').value;

    if (!login || !senha) {
        alert('❌ Informe nome/email e senha.');
        return;
    }

    await fazerLogin(login, senha);
}

// ========================================
// RENDERIZAÇÃO - SOLICITAÇÃO DE ACESSO
// ========================================

function renderizarSolicitarAcesso() {
    return `
        <div class="solicitar-container">
            <div class="solicitar-card">
                <button class="back-button" onclick="irParaPagina('login')">
                    ← Voltar
                </button>

                <h2 class="login-title" style="margin-bottom: 8px;">Solicitar Acesso</h2>
                <p class="login-subtitle" style="margin-bottom: 24px;">Preencha o formulário para solicitar acesso ao sistema</p>

                <div class="login-divider"></div>

                <form onsubmit="handleSolicitarAcesso(event)">
                    <div class="form-group">
                        <label class="form-label">Nome Completo</label>
                        <input type="text" class="form-input" id="nome" placeholder="Seu nome" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="email" placeholder="seu@email.com" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Senha</label>
                        <input type="password" class="form-input" id="senha" placeholder="Crie uma senha" minlength="4" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Tipo de Acesso</label>
                        <select class="form-select" id="papel" required>
                            <option value="">Selecione uma opção</option>
                            <option value="admin">Admin</option>
                            <option value="faturista">Faturista</option>
                            <option value="conferente">Conferente de Expedição</option>
                        </select>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        ✉️ Enviar Solicitação
                    </button>
                </form>
            </div>
        </div>
    `;
}

async function handleSolicitarAcesso(event) {
    event.preventDefault();
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const papel = document.getElementById('papel').value;

    if (!nome || !email || !senha || !papel) {
        alert('❌ Preencha todos os campos.');
        return;
    }

    await criarSolicitacao(nome, email, senha, papel);
}

async function handleAlterarSenha(event) {
    event.preventDefault();

    const senhaAtual = document.getElementById('senhaAtual').value;
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
        alert('❌ Preencha todos os campos.');
        return;
    }

    const alterou = await alterarSenhaUsuario(senhaAtual, novaSenha, confirmarSenha);
    if (alterou) {
        irParaPagina('dashboard', appState.currentUser);
    }
}

function renderizarConfiguracao() {
    return `
        <div class="solicitar-container">
            <div class="solicitar-card">
                <button class="back-button" onclick="irParaPagina('dashboard', appState.currentUser)">
                    ← Voltar
                </button>

                <h2 class="login-title" style="margin-bottom: 8px;">Configuração</h2>
                <p class="login-subtitle" style="margin-bottom: 24px;">Alterar senha de acesso</p>

                <div class="login-divider"></div>

                <form onsubmit="handleAlterarSenha(event)">
                    <div class="form-group">
                        <label class="form-label">Senha Atual</label>
                        <input type="password" class="form-input" id="senhaAtual" placeholder="Digite sua senha atual" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Nova Senha</label>
                        <input type="password" class="form-input" id="novaSenha" placeholder="Digite a nova senha" minlength="4" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Confirmar Nova Senha</label>
                        <input type="password" class="form-input" id="confirmarSenha" placeholder="Confirme a nova senha" minlength="4" required>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        🔐 Salvar Nova Senha
                    </button>
                </form>
            </div>
        </div>
    `;
}

// ========================================
// RENDERIZAÇÃO - DASHBOARD
// ========================================

function renderizarDashboard() {
    const usuario = appState.currentUser;

    if (usuario.papel === 'admin') {
        return renderizarAdminPanel();
    } else if (usuario.papel === 'faturista') {
        return renderizarFaturista();
    } else if (usuario.papel === 'conferente') {
        return renderizarConferente();
    }

    // Fallback seguro para papel inesperado (ex.: "user").
    return renderizarFaturista();
}

// ========================================
// PAINEL ADMINISTRATIVO
// ========================================

function renderizarAdminPanel() {
    return `
        <div class="dashboard-container">
            <div class="dashboard-content">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h1 class="dashboard-title">Painel Administrativo</h1>
                        <p style="color: var(--text-secondary);">Bem-vindo, ${appState.currentUser.nome}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary" onclick="abrirConfiguracao()">
                            ⚙️ Configuração
                        </button>
                        <button class="btn btn-secondary" onclick="fazerLogout()">
                            🚪 Sair
                        </button>
                    </div>
                </div>

                <div class="tabs">
                    <button class="tab-button active" onclick="abrirAba('solicitacoes')">
                        👥 Solicitações
                    </button>
                    <button class="tab-button" onclick="abrirAba('notas')">
                        📄 Notas Fiscais
                    </button>
                    <button class="tab-button" onclick="abrirAba('relatorios')">
                        📊 Relatórios
                    </button>
                </div>

                <div id="solicitacoes" class="tab-content active">
                    ${renderizarSolicitacoes()}
                </div>

                <div id="notas" class="tab-content">
                    ${renderizarNotasFiscaisAdmin()}
                </div>

                <div id="relatorios" class="tab-content">
                    ${renderizarRelatorios()}
                </div>
            </div>
        </div>
    `;
}

function renderizarSolicitacoes() {
    const solicitacoesPendentes = appState.solicitacoes.filter(s => String(s.status || '').trim().toLowerCase() === 'pendente');

    if (solicitacoesPendentes.length === 0) {
        return `
            <div class="table-container" style="text-align: center; padding: 40px;">
                <p style="color: var(--text-secondary);">Nenhuma solicitação pendente</p>
            </div>
        `;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    solicitacoesPendentes.forEach(sol => {
        html += `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="color: var(--text-primary); margin-bottom: 4px;">${sol.nome}</h3>
                        <p style="color: var(--text-secondary); font-size: 12px;">${sol.email}</p>
                        <span class="badge badge-pending">${sol.papel === 'admin' ? 'Admin' : sol.papel === 'faturista' ? 'Faturista' : 'Conferente'}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary" style="padding: 8px 16px;" onclick="aprovarSolicitacao(${sol.id})">
                            ✅ Aprovar
                        </button>
                        <button class="btn btn-secondary" style="padding: 8px 16px;" onclick="rejeitarSolicitacao(${sol.id})">
                            ❌ Rejeitar
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function renderizarNotasFiscaisAdmin() {
    const html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>NF</th>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    ${appState.notasFiscais.map(nf => `
                        <tr>
                            <td>${nf.numero}</td>
                            <td>${nf.cliente}</td>
                            <td>R$ ${nf.valor}</td>
                            <td>
                                <span class="badge ${
                                    nf.status === 'pendente' ? 'badge-pending' :
                                    nf.status === 'faturada' ? 'badge-faturada' :
                                    nf.status === 'expedida' ? 'badge-expedida' : ''
                                }">
                                    ${nf.status}
                                </span>
                            </td>
                            <td>${nf.dataEmissao}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    return html;
}

function renderizarRelatorios() {
    return `
        <div class="cards-grid">
            <div class="card" style="cursor: pointer;" onclick="exportarPlanilha('notasFiscais')">
                <div class="card-icon">📄</div>
                <h3 class="card-title">Notas Fiscais</h3>
                <p class="card-description">Exportar todas as notas fiscais</p>
            </div>

            <div class="card" style="cursor: pointer;" onclick="exportarPlanilha('faturamento')">
                <div class="card-icon">💰</div>
                <h3 class="card-title">Faturamento</h3>
                <p class="card-description">Exportar registros de faturamento</p>
            </div>

            <div class="card" style="cursor: pointer;" onclick="exportarPlanilha('expedicao')">
                <div class="card-icon">📦</div>
                <h3 class="card-title">Expedição</h3>
                <p class="card-description">Exportar registros de expedição</p>
            </div>
        </div>
    `;
}

function getTransportadorasFaturistaDisponiveis() {
    const transportadoras = appState.notasFiscais
        .filter((nf) => {
            const status = String(nf.status || '').trim().toLowerCase();
            return status !== 'expedida' && status !== 'entregue';
        })
        .map((nf) => String(nf.transportadora || '').trim())
        .filter(Boolean);

    return Array.from(new Set(transportadoras)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function setFiltroTransportadoraFaturista(valor) {
    appState.filtros.transportadoraFaturista = String(valor || '').trim();
    renderizar();
}

async function montarLinhasExportacaoFaturista(transportadoraFiltro) {
    const toNumber = (valor) => {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    };

    const normalizarNumeroNf = (valor) => String(valor || '').replace(/\D/g, '') || String(valor || '');
    const normalizarTexto = (valor) => String(valor || '').trim().toLowerCase();
    const derivarRes = (pedido) => {
        const digitos = String(pedido || '').replace(/\D/g, '');
        return digitos ? digitos.slice(-3) : '';
    };

    const notasCandidatas = appState.notasFiscais.filter((nf) => {
        const status = String(nf.status || '').trim().toLowerCase();
        return status !== 'expedida' && status !== 'entregue';
    });

    const linhas = [];

    for (const nota of notasCandidatas) {
        const numeroNf = normalizarNumeroNf(nota.numero);

        let dadosNf = null;
        if (numeroNf) {
            dadosNf = await buscarDadosNFNoSupabase(numeroNf);
            if (!dadosNf) {
                dadosNf = await buscarDadosNFNoXML(numeroNf);
            }
        }

        const artigo = String(dadosNf?.artigo ?? nota.artigo ?? '-');
        const pedido = String(dadosNf?.pedido ?? nota.pedido ?? '-');
        const pesoBruto = toNumber(dadosNf?.pesoBruto ?? nota.pesoBruto ?? 0);
        const metros = toNumber(dadosNf?.metros ?? nota.metros ?? 0);
        const pcs = toNumber(dadosNf?.quantidadeItens ?? nota.quantidadeItens ?? 0);
        const cliente = String(dadosNf?.cliente ?? nota.cliente ?? '-');
        const transportadora = String(dadosNf?.transportadora ?? nota.transportadora ?? '').trim();
        const dataNfRaw = String(dadosNf?.dataEmissao ?? nota.dataEmissao ?? '');

        if (!transportadora) {
            continue;
        }

        if (transportadoraFiltro && normalizarTexto(transportadora) !== normalizarTexto(transportadoraFiltro)) {
            continue;
        }

        const dataOrdenacao = new Date(dataNfRaw);
        const ts = Number.isFinite(dataOrdenacao.getTime()) ? dataOrdenacao.getTime() : Number.MAX_SAFE_INTEGER;

        linhas.push({
            artigo,
            pedido,
            pesoBruto,
            metros,
            pcs,
            cliente,
            nf: String(nota.numero || numeroNf || '-'),
            res: derivarRes(pedido),
            transp: transportadora,
            dataNf: dataNfRaw,
            ordemTs: ts,
        });
    }

    linhas.sort((a, b) => {
        if (a.ordemTs !== b.ordemTs) return a.ordemTs - b.ordemTs;
        return String(a.nf).localeCompare(String(b.nf), 'pt-BR', { numeric: true });
    });

    return linhas;
}

async function gerarPlanilhaFaturistaExcel() {
    const transportadoraFiltro = String(appState.filtros.transportadoraFaturista || '').trim();
    if (!transportadoraFiltro) {
        alert('❌ Selecione uma transportadora para exportar.');
        return;
    }

    const linhas = await montarLinhasExportacaoFaturista(transportadoraFiltro);
    if (linhas.length === 0) {
        alert('❌ Nenhuma NF disponível para a transportadora selecionada.');
        return;
    }

    const numeroFormatter = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const formatNumero = (valor) => numeroFormatter.format(Number(valor || 0));

    const formatData = (valor) => {
        const dt = new Date(String(valor || ''));
        if (!Number.isFinite(dt.getTime())) return String(valor || '');
        return dt.toLocaleDateString('pt-BR');
    };

    const escapeHtml = (valor) => String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const linhasHtml = linhas.map((l) => `
        <tr>
            <td>${escapeHtml(l.artigo)}</td>
            <td>${escapeHtml(l.pedido)}</td>
            <td style="text-align:right">${escapeHtml(formatNumero(l.pesoBruto))}</td>
            <td style="text-align:right">${escapeHtml(formatNumero(l.metros))}</td>
            <td style="text-align:right">${escapeHtml(formatNumero(l.pcs))}</td>
            <td>${escapeHtml(l.cliente)}</td>
            <td style="text-align:center">${escapeHtml(l.nf)}</td>
            <td style="text-align:center">${escapeHtml(l.res)}</td>
            <td>${escapeHtml(l.transp)}</td>
            <td style="text-align:center">${escapeHtml(formatData(l.dataNf))}</td>
        </tr>
    `).join('');

    const htmlExcel = `
<html>
<head>
    <meta charset="UTF-8" />
    <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
        th, td { border: 1px solid #000; padding: 5px 6px; font-size: 12px; }
        th { background: #efefef; font-weight: 700; text-align: center; }
        .titulo { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .sub { margin-bottom: 10px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="titulo">PLANILHA DE FATURAMENTO - FIFO POR DATA DA NF</div>
    <div class="sub">Transportadora: ${escapeHtml(transportadoraFiltro)} | Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
    <table>
        <tr>
            <th>Artigo</th>
            <th>Pedido</th>
            <th>Peso Bruto</th>
            <th>Metros</th>
            <th>PÇS</th>
            <th>Cliente</th>
            <th>NF</th>
            <th>Res</th>
            <th>Trans</th>
            <th>Data NF</th>
        </tr>
        ${linhasHtml}
    </table>
</body>
</html>`;

    const blob = new Blob(['\uFEFF', htmlExcel], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `faturamento_${transportadoraFiltro.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();

    alert('✅ Planilha do faturista exportada com sucesso!');
}

// ========================================
// INTERFACE DO FATURISTA
// ========================================

function renderizarFaturista() {
    const transportadorasDisponiveis = getTransportadorasFaturistaDisponiveis();
    if (appState.filtros.transportadoraFaturista && !transportadorasDisponiveis.includes(appState.filtros.transportadoraFaturista)) {
        appState.filtros.transportadoraFaturista = '';
    }

    return `
        <div class="dashboard-container">
            <div class="dashboard-content">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h1 class="dashboard-title">Faturista</h1>
                        <p style="color: var(--text-secondary);">${appState.currentUser.nome}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary" onclick="abrirConfiguracao()">
                            ⚙️ Configuração
                        </button>
                        <button class="btn btn-secondary" onclick="fazerLogout()">
                            🚪 Sair
                        </button>
                    </div>
                </div>

                <div class="bipagem-card" style="margin-bottom: 16px;">
                    <div style="display:flex; gap:12px; align-items:end; flex-wrap:wrap;">
                        <div style="min-width:280px; flex:1;">
                            <label class="form-label">Filtrar por Transportadora</label>
                            <select
                                class="form-select"
                                onchange="setFiltroTransportadoraFaturista(this.value)"
                                style="width:100%;"
                            >
                                <option value="" ${appState.filtros.transportadoraFaturista ? '' : 'selected'}>Selecione a transportadora</option>
                                ${transportadorasDisponiveis.map((t) => `<option value="${t}" ${appState.filtros.transportadoraFaturista === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-primary" style="min-height:44px;" onclick="gerarPlanilhaFaturistaExcel()">
                            📊 Exportar Planilha Faturista
                        </button>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 12px; margin-top: 10px;">
                        A exportação segue FIFO pela Data NF (mais antiga para mais nova) e não remove NFs não bipadas na expedição.
                    </p>
                </div>

                <div class="bipagem-container">
                    <div class="bipagem-card">
                        <div class="bipagem-header">
                            <div class="bipagem-icon">📊</div>
                            <h2 class="bipagem-title">Bipar Nota Fiscal</h2>
                        </div>

                        <div class="bipagem-input-group">
                            <label class="form-label">Código de Barras / Número da NF</label>
                            <input 
                                type="text" 
                                class="bipagem-input" 
                                id="codigoBarras" 
                                placeholder="Escaneie o código de barras ou digite o número da NF"
                                oninput="agendarBipagemAutomatica('faturamento')"
                                onkeydown="if(event.key==='Enter'){event.preventDefault();handleBiparFaturamento();}"
                                autofocus
                            >
                        </div>

                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" class="checkbox-input" id="usarDataManual" onchange="toggleDataManual()">
                                Usar data e hora manual
                            </label>

                            <div id="dataManualGroup" style="display: none; margin-top: 12px;">
                                <label class="form-label">Data e Hora</label>
                                <input type="datetime-local" class="datetime-input" id="dataHora">
                            </div>

                            <div id="dataAutomaticaGroup" style="margin-top: 12px; color: var(--text-secondary); font-size: 12px;">
                                🕐 Usando data e hora do sistema
                            </div>
                        </div>

                        <button class="btn btn-primary" style="width: 100%; min-height: 48px;" onclick="handleBiparFaturamento()">
                            📊 Bipar Nota Fiscal
                        </button>
                    </div>

                    <div id="ultimaBipagem" class="hidden"></div>

                    <div class="bipagem-card">
                        <h3 style="color: var(--text-primary); margin-bottom: 16px;">Histórico de Bipagens</h3>
                        <div class="history-list">
                            ${appState.bipagensFaturamento.length === 0 ? 
                                '<p style="color: var(--text-secondary);">Nenhuma bipagem registrada</p>' :
                                appState.bipagensFaturamento.map(b => `
                                    <div class="history-item">
                                        <div class="history-item-info">
                                            <p>NF #${b.numeroNF}</p>
                                            <p>${b.criadoEm}</p>
                                        </div>
                                        <span class="badge badge-faturada">Faturada</span>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function toggleDataManual() {
    const checkbox = document.getElementById('usarDataManual');
    const dataManualGroup = document.getElementById('dataManualGroup');
    const dataAutomaticaGroup = document.getElementById('dataAutomaticaGroup');

    if (checkbox.checked) {
        dataManualGroup.style.display = 'block';
        dataAutomaticaGroup.style.display = 'none';
        document.getElementById('dataHora').value = new Date().toISOString().slice(0, 16);
    } else {
        dataManualGroup.style.display = 'none';
        dataAutomaticaGroup.style.display = 'block';
    }
}

async function handleBiparFaturamento() {
    const codigoBarras = document.getElementById('codigoBarras').value;
    const numeroExtraido = extrairNumeroNF(codigoBarras);
    const usarDataManual = document.getElementById('usarDataManual').checked;
    const dataHora = usarDataManual ? document.getElementById('dataHora').value : new Date().toLocaleString('pt-BR');

    if (!numeroExtraido) {
        alert('Digite o código de barras!');
        return;
    }

    let dadosNF = await buscarDadosNFNoSupabase(numeroExtraido);
    if (!dadosNF) {
        dadosNF = await buscarDadosNFNoXML(numeroExtraido);
    }

    if (dadosNF && dadosNF.encontrada) {
        let resultado = buscarNotaPorCodigo(numeroExtraido);
        let nota = resultado ? resultado.nota : null;
        if (!nota) {
            nota = criarNotaAPartirDaLeitura(numeroExtraido);
        }
        aplicarDadosXMLNaNota(nota, dadosNF);
    }

    if (biparNota(numeroExtraido, dataHora, usarDataManual, 'faturamento')) {
        document.getElementById('codigoBarras').value = '';
        renderizar();
    }
}

// ========================================
// INTERFACE DO CONFERENTE
// ========================================

function renderizarConferente() {
    return `
        <div class="dashboard-container">
            <div class="dashboard-content">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h1 class="dashboard-title">Conferente de Expedição</h1>
                        <p style="color: var(--text-secondary);">${appState.currentUser.nome}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary" onclick="abrirConfiguracao()">
                            ⚙️ Configuração
                        </button>
                        <button class="btn btn-secondary" onclick="fazerLogout()">
                            🚪 Sair
                        </button>
                    </div>
                </div>

                <div class="bipagem-container">
                    <div class="bipagem-card">
                        <div class="bipagem-header">
                            <div class="bipagem-icon">📦</div>
                            <h2 class="bipagem-title">Bipar para Expedição</h2>
                        </div>

                        <div class="bipagem-input-group">
                            <label class="form-label">Código de Barras / Número da NF</label>
                            <input 
                                type="text" 
                                class="bipagem-input" 
                                id="codigoBarrasExp" 
                                placeholder="Escaneie o código de barras ou digite o número da NF"
                                oninput="agendarBipagemAutomatica('expedicao')"
                                onkeydown="if(event.key==='Enter'){event.preventDefault();handleBiparExpedicao();}"
                                autofocus
                            >
                        </div>

                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" class="checkbox-input" id="usarDataManualExp" onchange="toggleDataManualExp()">
                                Usar data e hora manual
                            </label>

                            <div id="dataManualGroupExp" style="display: none; margin-top: 12px;">
                                <label class="form-label">Data e Hora</label>
                                <input type="datetime-local" class="datetime-input" id="dataHoraExp">
                            </div>

                            <div id="dataAutomaticaGroupExp" style="margin-top: 12px; color: var(--text-secondary); font-size: 12px;">
                                🕐 Usando data e hora do sistema
                            </div>
                        </div>

                        <button class="btn btn-primary" style="width: 100%; min-height: 48px;" onclick="handleBiparExpedicao()">
                            📦 Bipar para Expedição
                        </button>
                    </div>

                    <div id="ultimaBipagemExp" class="hidden"></div>

                    <div class="bipagem-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="color: var(--text-primary); margin: 0;">Histórico de Expedições (${appState.bipagensExpedicao.length})</h3>
                            ${appState.bipagensExpedicao.length > 0 ? `
                                <button class="btn btn-primary" style="padding: 8px 16px;" onclick="gerarRelatorioExpedicaoExcel()">
                                    📊 Exportar Excel
                                </button>
                            ` : ''}
                        </div>
                        <div class="history-list">
                            ${appState.bipagensExpedicao.length === 0 ? 
                                '<p style="color: var(--text-secondary);">Nenhuma expedição registrada</p>' :
                                appState.bipagensExpedicao.map(b => `
                                    <div class="history-item">
                                        <div class="history-item-info">
                                            <p>NF #${b.numeroNF}</p>
                                            <p>${b.criadoEm}</p>
                                        </div>
                                        <span class="badge badge-expedida">Expedida</span>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function toggleDataManualExp() {
    const checkbox = document.getElementById('usarDataManualExp');
    const dataManualGroup = document.getElementById('dataManualGroupExp');
    const dataAutomaticaGroup = document.getElementById('dataAutomaticaGroupExp');

    if (checkbox.checked) {
        dataManualGroup.style.display = 'block';
        dataAutomaticaGroup.style.display = 'none';
        document.getElementById('dataHoraExp').value = new Date().toISOString().slice(0, 16);
    } else {
        dataManualGroup.style.display = 'none';
        dataAutomaticaGroup.style.display = 'block';
    }
}

function handleBiparExpedicao() {
    const codigoBarras = document.getElementById('codigoBarrasExp').value;
    const numeroExtraido = extrairNumeroNF(codigoBarras);
    const usarDataManual = document.getElementById('usarDataManualExp').checked;
    const dataHora = usarDataManual ? document.getElementById('dataHoraExp').value : new Date().toLocaleString('pt-BR');

    if (!numeroExtraido) {
        alert('Digite o código de barras!');
        return;
    }

    if (biparNota(numeroExtraido, dataHora, usarDataManual, 'expedicao')) {
        document.getElementById('codigoBarrasExp').value = '';
        renderizar();
    }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function abrirAba(nomeAba) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(nomeAba).classList.add('active');
    event.target.classList.add('active');
}

// ========================================
// RENDERIZAÇÃO PRINCIPAL
// ========================================

function renderizar() {
    const app = document.getElementById('app');
    let html = '';

    if (appState.currentPage === 'login') {
        html = renderizarLogin();
    } else if (appState.currentPage === 'solicitar-acesso') {
        html = renderizarSolicitarAcesso();
    } else if (appState.currentPage === 'configuracao') {
        html = renderizarConfiguracao();
    } else if (appState.currentPage === 'relatorio-expedicao') {
        html = `
            <div class="header">
                <div class="header-left">
                    <h1 class="header-title">System</h1>
                    <p class="header-subtitle">Sistema de Gestão de Faturamento e Expedição</p>
                </div>
            </div>
            ${renderizarRelatorioExpedicao()}
        `;
    } else if (appState.currentPage === 'dashboard') {
        html = `
            <div class="header">
                <div class="header-left">
                    <h1 class="header-title">System</h1>
                    <p class="header-subtitle">Sistema de Gestão de Faturamento e Expedição</p>
                </div>
            </div>
            ${renderizarDashboard()}
        `;
    }

    app.innerHTML = html;
}

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', async function() {
    document.title = APP_TITLE;
    await inicializarDados();
    renderizar();
});