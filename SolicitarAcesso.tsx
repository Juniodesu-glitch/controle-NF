import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SolicitarAcesso() {
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    papel: "faturista" as "faturista" | "conferente",
  });
  const [enviado, setEnviado] = useState(false);

  const criarSolicitacao = trpc.solicitacoes.criar.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.papel) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      await criarSolicitacao.mutateAsync({
        nome: formData.nome,
        email: formData.email,
        papel: formData.papel,
      });
      setEnviado(true);
      toast.success("Solicitação enviada com sucesso!");
    } catch (error) {
      toast.error("Erro ao enviar solicitação");
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-card flex items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-500/20 p-4 rounded-full">
                <CheckCircle className="text-green-500" size={48} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Solicitação Enviada!</h2>
            <p className="text-muted-foreground mb-8">
              Sua solicitação de acesso foi recebida. Um administrador analisará em breve.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="w-full rounded-xl"
            >
              Voltar ao Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "50px 50px"
        }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl">
          {/* Header com botão voltar */}
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Voltar</span>
          </button>

          {/* Título */}
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Solicitar Acesso
          </h1>
          <p className="text-muted-foreground mb-8">
            Preencha o formulário para solicitar acesso ao sistema
          </p>

          {/* Divider */}
          <div className="h-px bg-border mb-8" />

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome Completo
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Seu nome"
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>

            {/* Papel */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tipo de Acesso
              </label>
              <select
                value={formData.papel}
                onChange={(e) => setFormData({ ...formData, papel: e.target.value as "faturista" | "conferente" })}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="faturista">Faturista</option>
                <option value="conferente">Conferente de Expedição</option>
              </select>
            </div>

            {/* Botão Enviar */}
            <Button
              type="submit"
              disabled={criarSolicitacao.isPending}
              className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Send size={20} />
              {criarSolicitacao.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
