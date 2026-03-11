import React, { useEffect, useState } from "react";
import { trpc } from "@/App";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Loader2, Folder, RefreshCw } from "lucide-react";

type SourceType = "local" | "network" | "onedrive-pattern";

export default function ConfiguracoesNF() {
  const [nfPath, setNfPath] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("onedrive-pattern");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");

  const [validation, setValidation] = useState<{
    valid: boolean;
    error?: string;
    fileCount?: number;
    expandedPath?: string;
  } | null>(null);

  // Query para obter configuração atual
  const getNfSourcePath = trpc.settings.getNfSourcePath.useQuery(undefined, {
    retry: 1,
  });

  // Mutation para salvar configuração
  const setNfSourcePath = trpc.settings.setNfSourcePath.useMutation({
    onSuccess: (data) => {
      setValidation(null);
      getNfSourcePath.refetch();
      alert(`✓ ${data.message}`);
    },
    onError: (error) => {
      alert(`❌ Erro: ${error.message}`);
    },
  });

  // Mutation para validar caminho
  const validateNfPath = trpc.settings.validateNfPath.useMutation();

  // Preencher dados iniciais
  useEffect(() => {
    if (getNfSourcePath.data) {
      setNfPath(getNfSourcePath.data.currentPath);
      setSourceType((getNfSourcePath.data.sourceType as SourceType) || "onedrive-pattern");
      setSuggestions(getNfSourcePath.data.suggestions || []);
      setLastUpdated(getNfSourcePath.data.lastUpdated || "");
    }
  }, [getNfSourcePath.data]);

  const handleValidate = async () => {
    if (!nfPath.trim()) {
      alert("Digite um caminho válido");
      return;
    }

    setValidating(true);
    try {
      const result = await validateNfPath.mutateAsync({ nfSourcePath: nfPath });
      setValidation(result);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!validation?.valid) {
      alert("Configure um caminho válido antes de salvar");
      return;
    }

    setLoading(true);
    try {
      await setNfSourcePath.mutateAsync({
        nfSourcePath: nfPath,
        sourceType,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setNfPath(suggestion);
    setValidation(null);
  };

  const isConfigured = getNfSourcePath.data?.isAccessible;
  const currentFileCount = getNfSourcePath.data ? validation?.fileCount || 0 : 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Configuração de Origem dos XMLs
          </CardTitle>
          <CardDescription>
            Configure onde o importador deve buscar os arquivos XML das notas fiscais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Atual */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <h3 className="font-semibold mb-3">Status Atual</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Caminho Configurado</p>
                <p className="font-mono text-sm">{nfPath || "Não configurado"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Status</p>
                <div className="flex items-center gap-2">
                  {getNfSourcePath.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isConfigured ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">Acessível</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-600">
                        {nfPath ? "Não acessível" : "Não configurado"}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {isConfigured && (
                <div>
                  <p className="text-sm text-slate-600">XMLs Encontrados</p>
                  <p className="text-lg font-semibold">
                    {getNfSourcePath.data?.fileCount || 0}
                  </p>
                </div>
              )}
              {lastUpdated && (
                <div>
                  <p className="text-sm text-slate-600">Última Atualização</p>
                  <p className="text-sm">
                    {new Date(lastUpdated).toLocaleString("pt-BR")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Formulário de Configuração */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sourceType">Tipo de Origem</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                <SelectTrigger id="sourceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local (C:\Pasta\...)</SelectItem>
                  <SelectItem value="onedrive-pattern">
                    OneDrive (com padrões de busca)
                  </SelectItem>
                  <SelectItem value="network">Rede (\\servidor\pasta)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-600 mt-1">
                {sourceType === "local" &&
                  "Caminho local na máquina (ex: C:\\Users\\...\\nf-app)"}
                {sourceType === "onedrive-pattern" &&
                  "Procura automaticamente em pastas OneDrive sincronizadas"}
                {sourceType === "network" &&
                  "Caminho em servidor de rede (ex: \\\\servidor\\LOGISTICA\\nf-app)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nfPath">Caminho da Pasta</Label>
              <div className="flex gap-2">
                <Input
                  id="nfPath"
                  value={nfPath}
                  onChange={(e) => {
                    setNfPath(e.target.value);
                    setValidation(null);
                  }}
                  placeholder={
                    sourceType === "network"
                      ? "\\\\servidor\\LOGISTICA\\nf-app"
                      : "C:\\Users\\...\\OneDrive\\LOGISTICA...\\nf-app"
                  }
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={validating || !nfPath.trim()}
                >
                  {validating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-600">
                Suporta variáveis: %USERPROFILE%, %APPDATA%, etc
              </p>
            </div>

            {/* Sugestões */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <Label>Pastas OneDrive Detectadas</Label>
                <div className="space-y-2">
                  {suggestions.map((sug) => (
                    <div
                      key={sug}
                      className="p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition"
                      onClick={() => handleSelectSuggestion(sug)}
                    >
                      <p className="text-sm font-mono">{sug}</p>
                      <p className="text-xs text-slate-600">Clique para selecionar</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resultado da Validação */}
            {validation && (
              <div>
                {validation.valid ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      ✓ Caminho válido. {validation.fileCount} arquivos XML encontrados.
                      <br />
                      <span className="text-xs font-mono">{validation.expandedPath}</span>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      ❌ {validation.error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!validation?.valid || loading}
              className="flex.1"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar Configuração
            </Button>
            {isConfigured && (
              <Button
                variant="outline"
                onClick={() => getNfSourcePath.refetch()}
                disabled={getNfSourcePath.isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar Status
              </Button>
            )}
          </div>

          {/* Info Box */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-sm text-blue-900">
              <strong>💡 Dica:</strong> Você pode compartilhar a pasta via OneDrive, Teams ou um
              servidor de rede para que múltiplas máquinas acessem os mesmos XMLs sem estar
              vinculadas a uma máquina específica.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
