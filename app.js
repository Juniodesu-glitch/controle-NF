// ========================================
// SISTEMA TMS - GESTÃO DE FATURAMENTO E EXPEDIÇÃO
// ========================================

// Estado global da aplicação
const appState = {
    currentPage: 'login',
    currentUser: null,
    notasFiscais: [],
    bipagensFaturamento: [],
    bipagensExpedicao: [],
    solicitacoes: [],
    usuarios: []
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
        { id: 1, nome: 'Admin User', email: 'admin@tms.com', papel: 'admin', status: 'ativo' },
        { id: 2, nome: 'João Faturista', email: 'joao@tms.com', papel: 'faturista', status: 'ativo' },
        { id: 3, nome: 'Maria Conferente', email: 'maria@tms.com', papel: 'conferente', status: 'ativo' },
    ],
    solicitacoes: [
        { id: 1, nome: 'Pedro Silva', email: 'pedro@email.com', papel: 'faturista', status: 'pendente' },
        { id: 2, nome: 'Ana Santos', email: 'ana@email.com', papel: 'conferente', status: 'pendente' },
    ]
};

// Inicializar dados
function inicializarDados() {
    appState.notasFiscais = [...dadosSimulados.notasFiscais];
    appState.usuarios = [...dadosSimulados.usuarios];
    appState.solicitacoes = [...dadosSimulados.solicitacoes];
    appState.bipagensFaturamento = [];
    appState.bipagensExpedicao = [];
}

// ========================================
// FUNÇÕES DE NAVEGAÇÃO
// ========================================

function irParaPagina(pagina, usuario = null) {
    appState.currentPage = pagina;
    if (usuario) appState.currentUser = usuario;
    renderizar();
}

function fazerLogin(papel) {
    const usuario = {
        id: Math.random(),
        nome: papel === 'admin' ? 'Admin User' : papel === 'faturista' ? 'João Faturista' : 'Maria Conferente',
        papel: papel,
        email: `${papel}@tms.com`
    };
    irParaPagina('dashboard', usuario);
}

function fazerLogout() {
    appState.currentUser = null;
    appState.currentPage = 'login';
    renderizar();
}

// ========================================
// FUNÇÕES DE BIPAGEM
// ========================================

function biparNota(numeroNF, dataHora, dataHoraManual, tipo) {
    const nota = appState.notasFiscais.find(nf => nf.numero === numeroNF);
    
    if (!nota) {
        alert('❌ Nota fiscal não encontrada!');
        return false;
    }

    const bipagem = {
        id: Math.random(),
        notaFiscalId: nota.id,
        numeroNF: numeroNF,
        cliente: nota.cliente,
        valor: nota.valor,
        dataHora: dataHora,
        dataHoraManual: dataHoraManual,
        criadoEm: new Date().toLocaleString('pt-BR')
    };

    if (tipo === 'faturamento') {
        appState.bipagensFaturamento.push(bipagem);
        nota.status = 'faturada';
        alert('✅ Nota fiscal faturada com sucesso!');
    } else if (tipo === 'expedicao') {
        appState.bipagensExpedicao.push(bipagem);
        nota.status = 'expedida';
        alert('✅ Nota fiscal expedida com sucesso!');
    }

    return true;
}

// ========================================
// FUNÇÕES DE ADMINISTRAÇÃO
// ========================================

function aprovarSolicitacao(id) {
    const solicitacao = appState.solicitacoes.find(s => s.id === id);
    if (solicitacao) {
        solicitacao.status = 'aprovada';
        appState.usuarios.push({
            id: Math.random(),
            nome: solicitacao.nome,
            email: solicitacao.email,
            papel: solicitacao.papel,
            status: 'ativo'
        });
        alert('✅ Solicitação aprovada!');
        renderizar();
    }
}

function rejeitarSolicitacao(id) {
    const solicitacao = appState.solicitacoes.find(s => s.id === id);
    if (solicitacao) {
        solicitacao.status = 'rejeitada';
        alert('❌ Solicitação rejeitada!');
        renderizar();
    }
}

function criarSolicitacao(nome, email, papel) {
    appState.solicitacoes.push({
        id: Math.random(),
        nome: nome,
        email: email,
        papel: papel,
        status: 'pendente'
    });
    alert('✅ Solicitação enviada com sucesso!');
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

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR');
    const totalNotas = appState.bipagensExpedicao.length;
    const valorTotal = appState.bipagensExpedicao.reduce((total, b) => total + parseFloat(b.valor), 0);

    let conteudoHTML = `
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    margin: 30px; 
                    font-size: 12px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border: 2px solid #000;
                    padding: 15px;
                }
                .header h1 { margin: 5px 0; font-size: 18px; }
                .header p { margin: 3px 0; font-weight: bold; }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                    font-weight: bold;
                    font-size: 11px;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 15px 0;
                    border: 1px solid #000;
                }
                th, td { 
                    border: 1px solid #000; 
                    padding: 8px; 
                    text-align: left;
                    font-size: 11px;
                }
                th { 
                    background: #f0f0f0; 
                    font-weight: bold;
                }
                .total-row {
                    font-weight: bold;
                    background: #f0f0f0;
                }
                .assinatura {
                    margin-top: 40px;
                    display: flex;
                    justify-content: space-between;
                    gap: 30px;
                }
                .assinatura-box {
                    width: 30%;
                    text-align: center;
                }
                .assinatura-linha {
                    border-top: 1px solid #000;
                    margin-top: 40px;
                    padding-top: 5px;
                    font-size: 10px;
                    font-weight: bold;
                }
                .placa {
                    margin: 20px 0;
                    font-weight: bold;
                }
                .placa input {
                    border: 1px solid #000;
                    width: 200px;
                    height: 30px;
                    font-size: 16px;
                    text-align: center;
                }
                @media print {
                    body { margin: 0; padding: 0; }
                    .placa input { border: none; }
                    .placa input:focus { outline: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>CAPRICÓRNIO TÊXTIL S.A</h1>
                <p>CONTROLE DE EXPEDIÇÃO</p>
            </div>

            <div class="info-row">
                <span>DATA: ${dataAtual}</span>
                <span>HORA: ${horaAtual}</span>
            </div>

            <div class="info-row">
                <span>CONFERENTE: ${appState.currentUser.nome}</span>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 10%">NF</th>
                        <th style="width: 35%">CLIENTE</th>
                        <th style="width: 15%">VALOR</th>
                        <th style="width: 40%">DATA/HORA EXPEDIÇÃO</th>
                    </tr>
                </thead>
                <tbody>
                    ${appState.bipagensExpedicao.map((bipagem, index) => `
                        <tr>
                            <td>${bipagem.numeroNF}</td>
                            <td>${bipagem.cliente}</td>
                            <td>R$ ${bipagem.valor}</td>
                            <td>${bipagem.criadoEm}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="2">TOTAL: ${totalNotas} notas</td>
                        <td colspan="2">R$ ${valorTotal.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="placa">
                PLACA: <input type="text" placeholder="________________">
            </div>

            <div class="assinatura">
                <div class="assinatura-box">
                    <div class="assinatura-linha">Conferente</div>
                    <div style="font-size: 10px; margin-top: 5px;">${appState.currentUser.nome}</div>
                </div>
                <div class="assinatura-box">
                    <div class="assinatura-linha">Motorista</div>
                </div>
                <div class="assinatura-box">
                    <div class="assinatura-linha">Data</div>
                    <div style="font-size: 10px; margin-top: 5px;">${dataAtual}</div>
                </div>
            </div>
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
                    <h1 class="login-title">TMS System</h1>
                    <p class="login-subtitle">Sistema de Gestão de Faturamento e Expedição</p>
                </div>

                <div class="login-divider"></div>

                <div class="login-buttons">
                    <button class="btn btn-primary" onclick="mostrarOpcoesLogin()">
                        🔐 Fazer Login
                    </button>
                    <button class="btn btn-secondary" onclick="irParaPagina('solicitar-acesso')">
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

function mostrarOpcoesLogin() {
    const opcoes = `
Escolha seu tipo de acesso:

1. Admin - Controle total do sistema
2. Faturista - Bipagem de notas fiscais
3. Conferente - Expedição de notas fiscais

Digite o número (1, 2 ou 3):
    `;
    
    const escolha = prompt(opcoes);
    
    if (escolha === '1') {
        fazerLogin('admin');
    } else if (escolha === '2') {
        fazerLogin('faturista');
    } else if (escolha === '3') {
        fazerLogin('conferente');
    } else if (escolha !== null) {
        alert('Opção inválida!');
    }
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
                        <label class="form-label">Tipo de Acesso</label>
                        <select class="form-select" id="papel" required>
                            <option value="">Selecione uma opção</option>
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

function handleSolicitarAcesso(event) {
    event.preventDefault();
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const papel = document.getElementById('papel').value;
    
    criarSolicitacao(nome, email, papel);
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
                    <button class="btn btn-secondary" onclick="fazerLogout()">
                        🚪 Sair
                    </button>
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
    const solicitacoesPendentes = appState.solicitacoes.filter(s => s.status === 'pendente');

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
                        <span class="badge badge-pending">${sol.papel === 'faturista' ? 'Faturista' : 'Conferente'}</span>
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

// ========================================
// INTERFACE DO FATURISTA
// ========================================

function renderizarFaturista() {
    return `
        <div class="dashboard-container">
            <div class="dashboard-content">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h1 class="dashboard-title">Faturista</h1>
                        <p style="color: var(--text-secondary);">${appState.currentUser.nome}</p>
                    </div>
                    <button class="btn btn-secondary" onclick="fazerLogout()">
                        🚪 Sair
                    </button>
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

function handleBiparFaturamento() {
    const codigoBarras = document.getElementById('codigoBarras').value;
    const usarDataManual = document.getElementById('usarDataManual').checked;
    const dataHora = usarDataManual ? document.getElementById('dataHora').value : new Date().toLocaleString('pt-BR');

    if (!codigoBarras) {
        alert('Digite o código de barras!');
        return;
    }

    if (biparNota(codigoBarras, dataHora, usarDataManual, 'faturamento')) {
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
                    <button class="btn btn-secondary" onclick="fazerLogout()">
                        🚪 Sair
                    </button>
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
                                <button class="btn btn-primary" style="padding: 8px 16px;" onclick="abrirModalRelatorioExpedicao()">
                                    📊 Gerar Relatório
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
    const usarDataManual = document.getElementById('usarDataManualExp').checked;
    const dataHora = usarDataManual ? document.getElementById('dataHoraExp').value : new Date().toLocaleString('pt-BR');

    if (!codigoBarras) {
        alert('Digite o código de barras!');
        return;
    }

    if (biparNota(codigoBarras, dataHora, usarDataManual, 'expedicao')) {
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
    } else if (appState.currentPage === 'relatorio-expedicao') {
        html = `
            <div class="header">
                <div class="header-left">
                    <h1 class="header-title">TMS System</h1>
                    <p class="header-subtitle">Sistema de Gestão de Faturamento e Expedição</p>
                </div>
            </div>
            ${renderizarRelatorioExpedicao()}
        `;
    } else if (appState.currentPage === 'dashboard') {
        html = `
            <div class="header">
                <div class="header-left">
                    <h1 class="header-title">TMS System</h1>
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

document.addEventListener('DOMContentLoaded', function() {
    inicializarDados();
    renderizar();
});