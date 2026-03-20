import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, Barcode, Clock, CheckCircle, Package, Truck, User, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Conferente() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [codigoBarras, setCodigoBarras] = useState("");
  const [pedido, setPedido] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [quantidadePecas, setQuantidadePecas] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [usarDataManual, setUsarDataManual] = useState(false);
  const [dataHoraManual, setDataHoraManual] = useState(new Date().toISOString().slice(0, 16));
  const [ultimaBipagem, setUltimaBipagem] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const biparMutation = trpc.expedicao.biparComDetalhes.useMutation();
  const listarDetalhes = trpc.expedicao.listarDetalhes.useQuery();

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
        codigoBipado: codigoBarras,
        numeroNF: codigoBarras,
        pedido: pedido || undefined,
        nomeCliente: nomeCliente || undefined,
        quantidadePecas: quantidadePecas ? parseInt(quantidadePecas) : undefined,
        transportadora: transportadora || undefined,
        dataHora,
        dataHoraManual: usarDataManual,
      });

      setUltimaBipagem({
        ...resultado,
        dataHora: new Date().toLocaleString("pt-BR"),
        pedido,
        nomeCliente,
        quantidadePecas,
        transportadora,
      });
      
      setCodigoBarras("");
      setPedido("");
      setNomeCliente("");
      setQuantidadePecas("");
      setTransportadora("");
      
      toast.success("✓ Bipagem registrada e armazenada com sucesso!");
      listarDetalhes.refetch();
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar bipagem");
    }
  };

  const handleLogout = async () => {
    await trpc.auth.logout.useMutation().mutateAsync();
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - DESTAQUE */}
      <header className="bg-gradient-to-r from-primary/90 to-primary border-b-4 border-primary sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary-foreground flex items-center gap-2">
              <Barcode size={32} />
              CONFERENTE - EXPEDIÇÃO
            </h1>
            <p className="text-sm text-primary-foreground/90 mt-1">👤 {user?.name}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2 bg-primary-foreground text-primary hover:bg-white"
          >
            <LogOut size={18} />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Card Principal de Bipagem - AMPLIFICADO */}
        <div className="bg-card border-2 border-primary rounded-3xl p-8 shadow-2xl mb-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-primary/20 p-4 rounded-xl">
              <Barcode className="text-primary" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground">Bipar Código de Barras</h2>
              <p className="text-sm text-muted-foreground mt-1">Prioridade: Expedição do Conferente</p>
            </div>
          </div>

          {/* Input de Código de Barras - DESTAQUE */}
          <div className="mb-8">
            <label className="block text-sm font-bold text-primary mb-3 flex items-center gap-2">
              <Barcode size={18} />
              CÓDIGO DE BARRAS / NÚMERO DA NF
            </label>
            <input
              ref={inputRef}
              type="text"
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleBipar()}
              placeholder="➜ Escaneie o código de barras"
              className="w-full px-6 py-5 bg-secondary border-3 border-primary rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-3 focus:ring-primary focus:border-transparent transition-all text-xl font-semibold"
              autoFocus
            />
          </div>

          {/* Formulário de Abastecimento da Pasta */}
          <div className="bg-secondary/50 p-6 rounded-2xl border-2 border-primary/20 mb-8">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Package size={22} />
              Informações para Abastecimento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pedido */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <FileText size={16} />
                  Pedido
                </label>
                <input
                  type="text"
                  value={pedido}
                  onChange={(e) => setPedido(e.target.value)}
                  placeholder="Número do pedido"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Nome do Cliente */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <User size={16} />
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Quantidade de Peças */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Package size={16} />
                  Quantidade de Peças
                </label>
                <input
                  type="number"
                  value={quantidadePecas}
                  onChange={(e) => setQuantidadePecas(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Transportadora */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Truck size={16} />
                  Transportadora
                </label>
                <input
                  type="text"
                  value={transportadora}
                  onChange={(e) => setTransportadora(e.target.value)}
                  placeholder="Nome da transportadora"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Opção de Data/Hora */}
          <div className="mb-8 p-4 bg-secondary/50 rounded-xl border border-border">
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

          {/* Botão Bipar - DESTAQUE MÁXIMO */}
          <Button
            onClick={handleBipar}
            disabled={biparMutation.isPending || !codigoBarras.trim()}
            className="w-full h-16 text-xl font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Barcode size={28} />
            {biparMutation.isPending ? "⏳ PROCESSANDO..." : "✓ BIPAR PARA EXPEDIÇÃO"}
          </Button>
        </div>

        {/* Última Bipagem - DESTAQUE */}
        {ultimaBipagem && (
          <div className="bg-gradient-to-r from-green-500/10 to-green-400/5 border-2 border-green-500 rounded-2xl p-8 mb-8 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="bg-green-500/20 p-4 rounded-xl">
                <CheckCircle className="text-green-500" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-green-400 mb-3">✓ EXPEDIÇÃO REGISTRADA</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-foreground">
                  <p><strong>Código Bipado:</strong> {ultimaBipagem.numeroNF}</p>
                  <p><strong>Pedido:</strong> {ultimaBipagem.pedido || "Não informado"}</p>
                  <p><strong>Cliente:</strong> {ultimaBipagem.nomeCliente || "Não informado"}</p>
                  <p><strong>Peças:</strong> {ultimaBipagem.quantidadePecas || "N/A"}</p>
                  <p><strong>Transportadora:</strong> {ultimaBipagem.transportadora || "Não informada"}</p>
                  <p><strong>Data/Hora:</strong> {ultimaBipagem.dataHora}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Histórico de Bipagens */}
        {listarDetalhes.data && listarDetalhes.data.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Barcode size={24} />
              Histórico de Expedições do Conferente
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {listarDetalhes.data.slice(0, 15).map((bipagem: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  <div className="text-sm flex-1">
                    <p className="font-semibold text-foreground">📦 {bipagem.numeroNF || bipagem.codigoBipado}</p>
                    <p className="text-xs text-muted-foreground">Pedido: {bipagem.pedido || "N/A"} | Cliente: {bipagem.nomeCliente || "N/A"} | Qtd: {bipagem.quantidadePecas || "N/A"} | Transport: {bipagem.transportadora || "N/A"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      🕐 {new Date(bipagem.dataHoraBipagem).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-xs bg-green-500/20 text-green-400 px-4 py-2 rounded-full font-bold">
                    ✓ RECEBIDA
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
