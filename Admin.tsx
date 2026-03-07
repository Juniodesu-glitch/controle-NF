import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, Users, FileText, Download, CheckCircle, XCircle, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Admin() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"solicitacoes" | "notas" | "relatorios">("solicitacoes");

  const solicitacoes = trpc.solicitacoes.listar.useQuery();
  const notasFiscais = trpc.notasFiscais.listar.useQuery();
  const aprovarMutation = trpc.solicitacoes.aprovar.useMutation();
  const rejeitarMutation = trpc.solicitacoes.rejeitar.useMutation();
  const exportarMutation = trpc.admin.exportarPlanilha.useMutation();

  const handleLogout = async () => {
    await trpc.auth.logout.useMutation().mutateAsync();
    logout();
    navigate("/login");
  };

  const handleAprovar = async (id: number) => {
    try {
      await aprovarMutation.mutateAsync({ id });
      toast.success("Solicitação aprovada!");
      solicitacoes.refetch();
    } catch (error) {
      toast.error("Erro ao aprovar solicitação");
    }
  };

  const handleRejeitar = async (id: number) => {
    try {
      await rejeitarMutation.mutateAsync({ id });
      toast.success("Solicitação rejeitada!");
      solicitacoes.refetch();
    } catch (error) {
      toast.error("Erro ao rejeitar solicitação");
    }
  };

  const handleExportar = async (tipo: "notasFiscais" | "faturamento" | "expedicao") => {
    try {
      await exportarMutation.mutateAsync({ tipo });
      toast.success("Planilha exportada com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar planilha");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut size={18} />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-border">
          <button
            onClick={() => setActiveTab("solicitacoes")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "solicitacoes"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <Users size={18} />
              Solicitações de Acesso
            </div>
          </button>
          <button
            onClick={() => setActiveTab("notas")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "notas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText size={18} />
              Notas Fiscais
            </div>
          </button>
          <button
            onClick={() => setActiveTab("relatorios")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "relatorios"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <Download size={18} />
              Relatórios
            </div>
          </button>
        </div>

        {/* Solicitações de Acesso */}
        {activeTab === "solicitacoes" && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Solicitações de Acesso</h2>
            {solicitacoes.data && solicitacoes.data.length > 0 ? (
              <div className="space-y-4">
                {solicitacoes.data.map((solicitacao: any) => (
                  <div key={solicitacao.id} className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{solicitacao.nome}</h3>
                      <p className="text-sm text-muted-foreground">{solicitacao.email}</p>
                      <div className="mt-2 flex items-center gap-4">
                        <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">
                          {solicitacao.papel === "faturista" ? "Faturista" : "Conferente"}
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full ${
                          solicitacao.status === "pendente"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : solicitacao.status === "aprovada"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {solicitacao.status === "pendente" ? "Pendente" : solicitacao.status === "aprovada" ? "Aprovada" : "Rejeitada"}
                        </span>
                      </div>
                    </div>
                    {solicitacao.status === "pendente" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAprovar(solicitacao.id)}
                          disabled={aprovarMutation.isPending}
                          className="flex items-center gap-2 bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        >
                          <CheckCircle size={18} />
                          Aprovar
                        </Button>
                        <Button
                          onClick={() => handleRejeitar(solicitacao.id)}
                          disabled={rejeitarMutation.isPending}
                          variant="outline"
                          className="flex items-center gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
                        >
                          <XCircle size={18} />
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Clock className="mx-auto mb-4 text-muted-foreground" size={48} />
                <p className="text-muted-foreground">Nenhuma solicitação pendente</p>
              </div>
            )}
          </div>
        )}

        {/* Notas Fiscais */}
        {activeTab === "notas" && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Notas Fiscais</h2>
            {notasFiscais.data && notasFiscais.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">NF</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Cliente</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Valor</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notasFiscais.data.map((nf: any) => (
                      <tr key={nf.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                        <td className="py-3 px-4 text-foreground">{nf.numero}</td>
                        <td className="py-3 px-4 text-foreground">{nf.cliente}</td>
                        <td className="py-3 px-4 text-foreground">R$ {nf.valor}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-3 py-1 rounded-full ${
                            nf.status === "pendente"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : nf.status === "faturada"
                              ? "bg-blue-500/20 text-blue-400"
                              : nf.status === "expedida"
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-green-500/20 text-green-400"
                          }`}>
                            {nf.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(nf.dataEmissao).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <FileText className="mx-auto mb-4 text-muted-foreground" size={48} />
                <p className="text-muted-foreground">Nenhuma nota fiscal cadastrada</p>
              </div>
            )}
          </div>
        )}

        {/* Relatórios */}
        {activeTab === "relatorios" && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Exportar Relatórios</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <FileText className="text-primary mb-4" size={32} />
                <h3 className="text-lg font-semibold text-foreground mb-2">Notas Fiscais</h3>
                <p className="text-sm text-muted-foreground mb-4">Exportar todas as notas fiscais</p>
                <Button
                  onClick={() => handleExportar("notasFiscais")}
                  disabled={exportarMutation.isPending}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Exportar
                </Button>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <Download className="text-primary mb-4" size={32} />
                <h3 className="text-lg font-semibold text-foreground mb-2">Faturamento</h3>
                <p className="text-sm text-muted-foreground mb-4">Exportar registros de faturamento</p>
                <Button
                  onClick={() => handleExportar("faturamento")}
                  disabled={exportarMutation.isPending}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Exportar
                </Button>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <Download className="text-primary mb-4" size={32} />
                <h3 className="text-lg font-semibold text-foreground mb-2">Expedição</h3>
                <p className="text-sm text-muted-foreground mb-4">Exportar registros de expedição</p>
                <Button
                  onClick={() => handleExportar("expedicao")}
                  disabled={exportarMutation.isPending}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Exportar
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
