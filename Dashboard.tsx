import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, Barcode, Users, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

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
            <h1 className="text-2xl font-bold text-foreground">TMS System</h1>
            <p className="text-sm text-muted-foreground">Bem-vindo, {user?.name || "Usuário"}</p>
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
        {user?.role === "admin" ? (
          // Painel Admin
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-8">Painel Administrativo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card Gestão de Usuários */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => navigate("/admin")}>
                <div className="bg-primary/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Users className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Gestão de Usuários</h3>
                <p className="text-muted-foreground text-sm">Gerenciar solicitações e permissões</p>
              </div>

              {/* Card Notas Fiscais */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => navigate("/admin")}>
                <div className="bg-primary/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <FileText className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Notas Fiscais</h3>
                <p className="text-muted-foreground text-sm">Visualizar e gerenciar NFs</p>
              </div>

              {/* Card Relatórios */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => navigate("/admin")}>
                <div className="bg-primary/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Barcode className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Relatórios</h3>
                <p className="text-muted-foreground text-sm">Exportar planilhas e dados</p>
              </div>
            </div>
          </div>
        ) : (
          // Painel Operador
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-8">Operações</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Faturamento */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => navigate("/faturista")}>
                <div className="bg-primary/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Barcode className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Faturamento</h3>
                <p className="text-muted-foreground text-sm">Bipar notas fiscais para faturamento</p>
              </div>

              {/* Card Expedição */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => navigate("/conferente")}>
                <div className="bg-primary/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Barcode className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Expedição</h3>
                <p className="text-muted-foreground text-sm">Bipar notas fiscais para expedição</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
