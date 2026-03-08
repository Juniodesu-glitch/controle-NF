import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type UserRole = "admin" | "faturista" | "conferente";

type TransportadoraOption = {
  id: string;
  nome: string;
};

type BotaoFinalizaExpedicaoProps = {
  role: UserRole;
  conferenteNome?: string;
  carregamentoId?: string;
  canEncerrarCarregamento?: boolean;
  transportadoras?: TransportadoraOption[];
  exportEndpoint?: string;
  transportadorasEndpoint?: string;
  encerrarEndpoint?: string;
  className?: string;
  onCarregamentoEncerrado?: (carregamentoId: string) => void;
};

function getFileNameFromContentDisposition(headerValue: string | null): string | null {
  if (!headerValue) return null;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1] ?? null;
}

function baixarBlob(blob: Blob, fileName: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export default function BotaoFinalizaExpedicao({
  role,
  conferenteNome,
  carregamentoId,
  canEncerrarCarregamento = false,
  transportadoras,
  exportEndpoint = "/api/export/expedidas",
  transportadorasEndpoint = "/api/transportadoras",
  encerrarEndpoint = "/api/carregamentos/encerrar",
  className,
  onCarregamentoEncerrado,
}: BotaoFinalizaExpedicaoProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [modoData, setModoData] = useState<"single" | "range">("single");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [transportadoraId, setTransportadoraId] = useState("");

  const [encerrando, setEncerrando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [carregamentoFinalizado, setCarregamentoFinalizado] = useState(false);

  const [listaTransportadoras, setListaTransportadoras] = useState<TransportadoraOption[]>(
    transportadoras ?? []
  );
  const [loadingTransportadoras, setLoadingTransportadoras] = useState(false);

  const isConferente = role === "conferente";
  const isAdminOuFaturista = role === "admin" || role === "faturista";

  useEffect(() => {
    if (!isAdminOuFaturista) return;

    if (transportadoras && transportadoras.length > 0) {
      setListaTransportadoras(transportadoras);
      return;
    }

    let ativo = true;
    setLoadingTransportadoras(true);

    fetch(transportadorasEndpoint)
      .then(async response => {
        if (!response.ok) {
          throw new Error("Falha ao carregar transportadoras");
        }

        const payload = (await response.json()) as TransportadoraOption[];
        if (ativo) {
          setListaTransportadoras(Array.isArray(payload) ? payload : []);
        }
      })
      .catch(() => {
        toast.error("Nao foi possivel carregar as transportadoras");
      })
      .finally(() => {
        if (ativo) setLoadingTransportadoras(false);
      });

    return () => {
      ativo = false;
    };
  }, [isAdminOuFaturista, transportadoras, transportadorasEndpoint]);

  const labelBotaoPrincipal = useMemo(() => {
    return "Finalizar";
  }, []);

  const botaoPrincipalDesabilitado = useMemo(() => {
    if (baixando) return true;
    if (isConferente) return !carregamentoFinalizado;
    return false;
  }, [baixando, isConferente, carregamentoFinalizado]);

  async function iniciarDownload(payload: Record<string, unknown>) {
    setBaixando(true);

    try {
      const response = await fetch(exportEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Falha ao gerar Excel");
      }

      const blob = await response.blob();
      const fileName =
        getFileNameFromContentDisposition(response.headers.get("content-disposition")) ||
        "nfs-expedidas.xlsx";

      baixarBlob(blob, fileName);
      toast.success("Download iniciado com sucesso");
    } catch {
      toast.error("Erro ao baixar o arquivo Excel");
    } finally {
      setBaixando(false);
    }
  }

  async function handleGerarExcelComFiltro() {
    if (!dataInicio) {
      toast.error("Selecione a data de expedicao");
      return;
    }

    if (modoData === "range" && !dataFim) {
      toast.error("Selecione a data final do periodo");
      return;
    }

    const payload: Record<string, unknown> = {
      dataInicio,
      transportadoraId: transportadoraId || null,
      status: "expedida",
    };

    if (modoData === "range") {
      payload.dataFim = dataFim;
    }

    await iniciarDownload(payload);
    setModalAberto(false);
  }

  async function handleEncerrarCarregamento() {
    if (!carregamentoId) {
      toast.error("Carregamento nao informado");
      return;
    }

    if (!canEncerrarCarregamento) {
      toast.error("Ainda existem NFs pendentes de bipagem");
      return;
    }

    const confirmou = window.confirm(
      "Todas as NFs bipadas foram expedidas com sucesso. Deseja finalizar?"
    );

    if (!confirmou) return;

    setEncerrando(true);

    try {
      const response = await fetch(encerrarEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ carregamentoId }),
      });

      if (!response.ok) {
        throw new Error("Falha ao encerrar carregamento");
      }

      setCarregamentoFinalizado(true);
      onCarregamentoEncerrado?.(carregamentoId);
      toast.success("Carregamento encerrado. Botao Finalizar habilitado.");
    } catch {
      toast.error("Erro ao encerrar o carregamento");
    } finally {
      setEncerrando(false);
    }
  }

  async function handleFinalizarConferente() {
    if (!carregamentoId) {
      toast.error("Carregamento nao informado");
      return;
    }

    await iniciarDownload({
      status: "expedida",
      contexto: "carregamento",
      carregamentoId,
      role: "conferente",
    });

    const nome = conferenteNome?.trim() || "conferente";
    toast.success(`Download iniciado: NFs expedidas pelo conferente ${nome}`);
  }

  return (
    <div className={["w-full", className].filter(Boolean).join(" ")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {isConferente && (
          <Button
            type="button"
            onClick={handleEncerrarCarregamento}
            disabled={encerrando || !canEncerrarCarregamento || carregamentoFinalizado}
            className="h-12 px-6 rounded-xl"
            variant="outline"
          >
            {encerrando ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Encerrar Carregamento
          </Button>
        )}

        {isAdminOuFaturista ? (
          <Dialog open={modalAberto} onOpenChange={setModalAberto}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="h-14 px-8 text-base font-semibold rounded-xl bg-green-600 hover:bg-green-700 text-white"
                disabled={baixando}
              >
                {baixando ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Download className="mr-2 h-5 w-5" />
                )}
                {labelBotaoPrincipal}
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Gerar Excel de NFs Expedidas</DialogTitle>
                <DialogDescription>
                  Selecione data de expedicao e transportadora para gerar o arquivo.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de data</label>
                  <div className="flex items-center gap-4">
                    <label className="text-sm flex items-center gap-2">
                      <input
                        type="radio"
                        name="modoData"
                        value="single"
                        checked={modoData === "single"}
                        onChange={() => setModoData("single")}
                      />
                      Data unica
                    </label>
                    <label className="text-sm flex items-center gap-2">
                      <input
                        type="radio"
                        name="modoData"
                        value="range"
                        checked={modoData === "range"}
                        onChange={() => setModoData("range")}
                      />
                      Periodo
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data de expedicao (obrigatorio)</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 bg-background"
                  />
                </div>

                {modoData === "range" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data final</label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={e => setDataFim(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 bg-background"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Transportadora</label>
                  <select
                    value={transportadoraId}
                    onChange={e => setTransportadoraId(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 bg-background"
                    disabled={loadingTransportadoras}
                  >
                    <option value="">Todas</option>
                    {listaTransportadoras.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleGerarExcelComFiltro}
                  disabled={baixando}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {baixando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Gerar Excel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button
            type="button"
            onClick={handleFinalizarConferente}
            disabled={botaoPrincipalDesabilitado}
            className={[
              "h-14 px-8 text-base font-semibold rounded-xl",
              botaoPrincipalDesabilitado
                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white",
            ].join(" ")}
          >
            {baixando ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Download className="mr-2 h-5 w-5" />
            )}
            {labelBotaoPrincipal}
          </Button>
        )}
      </div>
    </div>
  );
}
