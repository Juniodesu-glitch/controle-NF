import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { LogIn, FileText } from "lucide-react";

export default function Login() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (user) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card flex items-center justify-center p-4">
      {/* Fundo com efeito de grid */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "50px 50px"
        }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card de Login */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl">
          {/* Logo/Header */}
          <div className="flex items-center justify-center mb-8">
            <div className="bg-primary/20 p-4 rounded-2xl">
              <FileText className="text-primary" size={32} />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-3xl font-bold text-center text-foreground mb-2">
            System
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            Sistema de Gestão de Faturamento e Expedição
          </p>

          {/* Divider */}
          <div className="h-px bg-border mb-8" />

          {/* Botões */}
          <div className="space-y-4">
            {/* Botão de Login */}
            <a href={getLoginUrl()}>
              <Button
                className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 flex items-center justify-center gap-2"
              >
                <LogIn size={20} />
                Fazer Login
              </Button>
            </a>

            {/* Botão de Solicitar Acesso */}
            <Button
              onClick={() => {
                const url = new URL(window.location.href);
                url.pathname = "/solicitar-acesso";
                window.location.href = url.toString();
              }}
              variant="outline"
              className="w-full h-12 text-base font-semibold rounded-xl border-2 border-primary/30 hover:border-primary/60 text-foreground transition-all duration-200"
            >
              Solicitar Acesso
            </Button>
          </div>

          {/* Footer Info */}
          <div className="mt-8 p-4 bg-secondary/50 rounded-xl border border-border">
            <p className="text-xs text-muted-foreground text-center">
              Acesso seguro com autenticação Manus OAuth. Seus dados estão protegidos.
            </p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid grid-cols-1 gap-4">
          <div className="bg-card/50 border border-border rounded-2xl p-4 backdrop-blur">
            <p className="text-sm font-semibold text-foreground mb-1">🔐 Seguro</p>
            <p className="text-xs text-muted-foreground">Autenticação OAuth integrada</p>
          </div>
          <div className="bg-card/50 border border-border rounded-2xl p-4 backdrop-blur">
            <p className="text-sm font-semibold text-foreground mb-1">⚡ Rápido</p>
            <p className="text-xs text-muted-foreground">Interface otimizada para bipagem</p>
          </div>
        </div>
      </div>
    </div>
  );
}
