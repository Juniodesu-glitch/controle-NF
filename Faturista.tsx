import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, Barcode, Clock, CheckCircle, AlertCircle, FileDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Faturista() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [codigoBarras, setCodigoBarras] = useState("");
  const [usarDataManual, setUsarDataManual] = useState(false);
  const [dataHoraManual, setDataHoraManual] = useState(new Date().toISOString().slice(0, 16));
  const [ultimaBipagem, setUltimaBipagem] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const biparMutation = trpc.faturamento.bipar.useMutation();
  const listarBipagens = trpc.faturamento.listar.useQuery();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBipar = async () => {
    if (!codigoBarras.trim()) {
      toast.error("Digite o código de barras");
      return;
    }

    try {
      const dataHora = usarDataManual
        ? new Date(dataHoraManual)
        : new Date();

      const resultado = await biparMutation.mutateAsync({
        numeroNF: codigoBarras,
        dataHora,
        dataHoraManual: usarDataManual,
      });

      setUltimaBipagem(resultado);
      setCodigoBarras("");
      toast.success("Nota fiscal faturada com sucesso!");
      if (resultado?.xmlSalvo) {
        toast.success(`XML processado: ${resultado.xmlArquivo || "OK"}`);
      } else {
        toast.info(resultado?.xmlMotivo || "XML será lido apenas da pasta configurada");
      }
      listarBipagens.refetch();
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error: any) {
      toast.error(error.message || "Erro ao bipar nota fiscal");
    }
  };

  const handleLogout = async () => {
    await trpc.auth.logout.useMutation().mutateAsync();
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faturista</h1>
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
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Card de Bipagem */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-lg mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/20 p-3 rounded-xl">
              <Barcode className="text-primary" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Bipar Nota Fiscal</h2>
          </div>

          {/* Input de Código de Barras */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-3">
              Código de Barras / Número da NF
            </label>
            <input
              ref={inputRef}
              type="text"
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleBipar()}
              placeholder="Escaneie o código de barras ou digite o número da NF"
              className="w-full px-4 py-4 bg-secondary border-2 border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-lg"
              autoFocus
            />
          </div>

          {/* Opção de Data/Hora */}
          <div className="mb-6 p-4 bg-secondary/50 rounded-xl border border-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={usarDataManual}
                onChange={(e) => setUsarDataManual(e.target.checked)}
                className="w-5 h-5 rounded border-border cursor-pointer"
              />
              <span className="text-foreground font-medium">Usar data e hora manual</span>
            </label>

            {usarDataManual && (
              <div className="mt-4">
                <label className="block text-sm text-muted-foreground mb-2">
                  Data e Hora
                </label>
                <input
                  type="datetime-local"
                  value={dataHoraManual}
                  onChange={(e) => setDataHoraManual(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {!usarDataManual && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={16} />
                <span>Usando data e hora do sistema</span>
              </div>
            )}
          </div>

          {/* Botão Bipar */}
          <Button
            onClick={handleBipar}
            disabled={biparMutation.isPending || !codigoBarras.trim()}
            className="w-full h-14 text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Barcode size={24} />
            {biparMutation.isPending ? "Processando..." : "Bipar Nota Fiscal"}
          </Button>
        </div>

        {/* Última Bipagem */}
        {ultimaBipagem && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="bg-green-500/20 p-3 rounded-xl">
                <CheckCircle className="text-green-500" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-400 mb-2">Faturamento Realizado</h3>
                <div className="space-y-1 text-sm text-foreground">
                  <p><strong>NF:</strong> {ultimaBipagem.notaFiscal.numero}</p>
                  <p><strong>Cliente:</strong> {ultimaBipagem.notaFiscal.cliente}</p>
                  <p><strong>Produto:</strong> {ultimaBipagem.notaFiscal.artigo || ultimaBipagem.notaFiscal.produtoNome || "Não informado"}</p>
                  <p><strong>Valor:</strong> R$ {ultimaBipagem.notaFiscal.valor}</p>
                  <p><strong>Horário:</strong> {new Date().toLocaleTimeString("pt-BR")}</p>
                </div>
                <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                  ultimaBipagem.xmlSalvo
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                }`}>
                  <FileDown size={16} />
                  {ultimaBipagem.xmlSalvo
                    ? `XML processado: ${ultimaBipagem.xmlArquivo || "OK"}`
                    : `XML: ${ultimaBipagem.xmlMotivo || "não disponível"}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Histórico de Bipagens */}
        {listarBipagens.data && listarBipagens.data.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Histórico de Bipagens</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {listarBipagens.data.slice(0, 10).map((bipagem: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border">
                  <div className="text-sm">
                    <p className="font-medium text-foreground">NF #{bipagem.notaFiscalId}</p>
                    <p className="text-xs text-muted-foreground">
                      Produto: {bipagem.notaFiscal?.artigo || bipagem.notaFiscal?.produtoNome || "Não informado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bipagem.criadoEm).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">
                    Faturada
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
