import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import SolicitarAcesso from "./pages/SolicitarAcesso";
import Dashboard from "./pages/Dashboard";
import Faturista from "./pages/Faturista";
import Conferente from "./pages/Conferente";
import Admin from "./pages/Admin";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component, requiredRole }: { component: any; requiredRole?: string }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <NotFound />;
  }

  return <Component />;
}

// Componentes de rota definidos FORA do Router para evitar re-criação a cada render,
// o que causava desmontagem do componente e reset do estado (ex: aba ativa do Admin).
const DashboardRoute = () => <ProtectedRoute component={Dashboard} />;
const FaturistaRoute = () => <ProtectedRoute component={Faturista} requiredRole="user" />;
const ConferenteRoute = () => <ProtectedRoute component={Conferente} requiredRole="user" />;
const AdminRoute = () => <ProtectedRoute component={Admin} requiredRole="admin" />;

function HomeRoute() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <Login />;
}

function Router() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/solicitar-acesso" component={SolicitarAcesso} />

      {/* Rotas protegidas */}
      <Route path="/dashboard" component={DashboardRoute} />
      <Route path="/faturista" component={FaturistaRoute} />
      <Route path="/conferente" component={ConferenteRoute} />
      <Route path="/admin" component={AdminRoute} />

      <Route path="/" component={HomeRoute} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
