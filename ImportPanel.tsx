import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, RefreshCw, AlertCircle, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ImportTask {
  id: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt: string | null;
  force: boolean;
  exitCode: number | null;
  error: string | null;
  logCount: number;
}

export default function ImportPanel() {
  const [tasks, setTasks] = useState<ImportTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTaskLogs, setSelectedTaskLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  // Dispara um novo import
  const handleStartImport = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/import/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.ok) {
        toast.success("Importação iniciada!");
        // Recarrega lista de tasks
        await refreshTasks();
      } else {
        toast.error(data.error || "Erro ao iniciar importação");
      }
    } catch (error) {
      console.error("ImportPanel startImport error:", error);
      toast.error("Erro ao iniciar importação");
    } finally {
      setIsLoading(false);
    }
  };

  // Recarrega lista de tasks
  const refreshTasks = async () => {
    try {
      const response = await fetch("/api/import/trigger?action=list");
      if (!response.ok) throw new Error("Erro ao listar tasks");

      const data = await response.json();
      if (data.ok) {
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("RefreshTasks error:", error);
    }
  };

  // Carrega logs de uma task específica
  const loadTaskLogs = async (taskId: string) => {
    try {
      setSelectedTaskLogs(taskId);
      const response = await fetch(`/api/import/trigger?action=logs&taskId=${taskId}&limit=500`);
      if (!response.ok) throw new Error("Erro ao carregar logs");

      const data = await response.json();
      if (data.ok) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("LoadTaskLogs error:", error);
      toast.error("Erro ao carregar logs");
    }
  };

  // Auto-refresh a cada 3 segundos quando há tasks em execução
  useEffect(() => {
    const hasRunning = tasks.some((t: ImportTask) => t.status === "running");
    if (!hasRunning) return;

    const interval = setInterval(() => {
      refreshTasks();
    }, 3000);

    return () => clearInterval(interval);
  }, [tasks]);

  useEffect(() => {
    refreshTasks();
  }, []);

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Importar XMLs</h3>
          <p className="text-sm text-muted-foreground mb-4">
            📁 Pasta de origem: <code className="bg-muted px-2 py-1 rounded text-xs">
              C:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\nf--app2.0
            </code>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            onClick={() => handleStartImport(false)}
            disabled={isLoading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Upload size={18} />
            {isLoading ? "Iniciando..." : "Importar Novos"}
          </Button>
          <Button
            onClick={() => handleStartImport(true)}
            disabled={isLoading}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
          >
            <RefreshCw size={18} />
            Reimportar Tudo
          </Button>
          <Button
            onClick={refreshTasks}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Lista de Tasks */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Histórico de Importações</h3>

        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock size={32} className="mx-auto mb-2 opacity-50" />
            <p>Nenhuma importação ainda</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {tasks.map((task: ImportTask) => (
              <div
                key={task.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedTaskLogs === task.id
                    ? "bg-primary/10 border-primary"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => loadTaskLogs(task.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {task.status === "running" && (
                      <Clock size={20} className="text-blue-500 animate-spin" />
                    )}
                    {task.status === "completed" && (
                      <CheckCircle2 size={20} className="text-green-500" />
                    )}
                    {task.status === "failed" && (
                      <AlertCircle size={20} className="text-red-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between mb-1">
                      <span className="text-sm font-medium">
                        Task {task.id.slice(0, 8)}...
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          task.status === "running"
                            ? "bg-blue-500/20 text-blue-400"
                            : task.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {task.status === "running"
                          ? "Executando..."
                          : task.status === "completed"
                          ? "Concluído"
                          : "Falhou"}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        Iniciado: {new Date(task.startedAt).toLocaleString("pt-BR")}
                      </p>
                      {task.finishedAt && (
                        <p>
                          Finalizado: {new Date(task.finishedAt).toLocaleString("pt-BR")}
                        </p>
                      )}
                      <p>{task.logCount} linhas de log</p>
                      {task.force && <p className="font-semibold">🔄 Reimportação completa</p>}
                      {task.error && (
                        <p className="text-red-400 mt-1">{task.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visualizador de Logs */}
      {selectedTaskLogs && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Logs - Task {selectedTaskLogs.slice(0, 8)}...
            </h3>
            <Button
              onClick={() => setSelectedTaskLogs(null)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Trash2 size={16} />
              Limpar
            </Button>
          </div>

          <div className="bg-black/20 border border-border rounded p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">Carregando logs...</p>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`${
                    log.type === "error"
                      ? "text-red-400"
                      : log.type === "info"
                      ? "text-blue-400"
                      : "text-green-400"
                  }`}
                >
                  <span className="text-muted-foreground">
                    [{new Date(log.timestamp).toLocaleTimeString("pt-BR")}]
                  </span>{" "}
                  {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
