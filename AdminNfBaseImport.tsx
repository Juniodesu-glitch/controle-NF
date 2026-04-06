import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

type NfBaseRow = Record<string, string>;

const STORAGE_KEY = "adminNfBase";

function sanitizeHeader(header: string) {
  return String(header || "").trim();
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => String(value || "").trim());
}

function parseCsvText(text: string): { headers: string[]; rows: NfBaseRow[] } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const firstLine = lines[0];
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const headers = parseCsvLine(firstLine, delimiter).map(sanitizeHeader);

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce<NfBaseRow>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });

  return { headers, rows };
}

export default function AdminNfBaseImport() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<NfBaseRow[]>([]);
  const [numeroNfColumn, setNumeroNfColumn] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<NfBaseRow | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { headers: string[]; rows: NfBaseRow[] };
      if (Array.isArray(parsed.headers) && Array.isArray(parsed.rows)) {
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setNumeroNfColumn(parsed.headers.find((header) => /nf|numero|número/i.test(header)) || "");
      }
    } catch {
      // ignore invalid data
    }
  }, []);

  const sampleRows = useMemo(() => rows.slice(0, 5), [rows]);

  const persistBase = (nextHeaders: string[], nextRows: NfBaseRow[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ headers: nextHeaders, rows: nextRows }));
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setFileName("");
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv') {
      toast.error('Por enquanto a importação aceita apenas CSV.');
      return;
    }

    const text = await file.text();
    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0) {
      toast.error("Arquivo inválido ou sem cabeçalho.");
      return;
    }

    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setFileName(file.name);

    const guessed = parsed.headers.find((header) => /nf|numero|número/i.test(header));
    if (guessed) {
      setNumeroNfColumn(guessed);
    }

    persistBase(parsed.headers, parsed.rows);
    toast.success(`Base importada com ${parsed.rows.length} registros.`);
  };

  const handleClearBase = () => {
    setHeaders([]);
    setRows([]);
    setNumeroNfColumn("");
    setSearchQuery("");
    setSearchResult(null);
    setFileName("");
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Base de NF removida.");
  };

  const handleSearch = () => {
    if (!searchQuery.trim() || !numeroNfColumn) {
      toast.error("Informe um número de NF e escolha a coluna correta.");
      return;
    }

    const normalized = String(searchQuery).trim();
    const found = rows.find((row) => String(row[numeroNfColumn] || "").trim() === normalized);
    if (found) {
      setSearchResult(found);
      toast.success("NF encontrada na base.");
    } else {
      setSearchResult(null);
      toast.error("NF não encontrada na base.");
    }
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Base de NFs</h2>
        <p className="text-sm text-muted-foreground">
          Carregue uma planilha CSV com todas as notas fiscais e seus campos.
          A base é salva localmente no navegador para ser consultada pelo admin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-secondary/80 p-6">
          <p className="text-sm text-muted-foreground mb-3">Carregar base de NF</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:border-primary/50">
            <Upload size={18} />
            Selecionar arquivo
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <p className="text-xs text-muted-foreground mt-3">Apenas arquivos CSV são aceitos no momento.</p>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-secondary/80 p-4">
            <p className="text-sm text-muted-foreground">Arquivo</p>
            <p className="font-medium text-foreground">{fileName || "Nenhum arquivo carregado"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/80 p-4">
            <p className="text-sm text-muted-foreground">Registros</p>
            <p className="font-medium text-foreground">{rows.length}</p>
          </div>
        </div>
      </div>

      {headers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <label className="block text-sm text-foreground">
            Coluna do número da NF
            <select
              value={numeroNfColumn}
              onChange={(event) => setNumeroNfColumn(event.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione a coluna</option>
              {headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <label className="block text-sm text-foreground">Buscar NF na base</label>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Digite o número da NF"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <Button onClick={handleSearch} className="min-w-[140px] flex items-center gap-2">
                <Search size={16} /> Buscar
              </Button>
            </div>
          </div>
        </div>
      )}

      {searchResult && (
        <div className="rounded-2xl border border-border bg-secondary/80 p-4">
          <h3 className="text-lg font-semibold text-foreground mb-3">Resultado da Busca</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(searchResult).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">{key}</p>
                <p className="text-sm text-foreground">{value || "-"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sampleRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Amostra de registros carregados</p>
            <Button variant="outline" onClick={handleClearBase} className="flex items-center gap-2">
              <Trash2 size={16} /> Limpar base
            </Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border bg-background">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {headers.slice(0, 6).map((header) => (
                    <th key={header} className="py-3 px-3 font-semibold text-foreground">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, index) => (
                  <tr key={index} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    {headers.slice(0, 6).map((header) => (
                      <td key={header} className="py-3 px-3 text-foreground">{row[header] || "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Exibindo até 5 registros e até 6 colunas para facilitar a visualização.
          </p>
        </div>
      )}
    </div>
  );
}
