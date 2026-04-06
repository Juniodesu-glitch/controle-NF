import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SheetName = "Capa" | "Itens" | "Notas Sem Remessa" | "Notas de Remessa";

const sheetNames: SheetName[] = ["Capa", "Itens", "Notas Sem Remessa", "Notas de Remessa"];

interface SheetData {
  headers: string[];
  rows: Record<string, string>[];
}

const extractNumeroNF = (chave: string) => {
  if (!chave) return "";
  if (chave.length === 44) {
    return chave.slice(25, 34);
  }
  return chave.replace(/\D/g, "");
};

const sanitizeCell = (value: string) => value.replace(/^\s+|\s+$/g, "");

const parseCsvLine = (line: string, delimiter: string) => {
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
  return values.map((value) => sanitizeCell(value.replace(/^"|"$/g, "")));
};

const parseCsvText = (text: string): SheetData => {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = normalized.split("\n").filter((line) => line.trim() !== "");
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const firstLine = rows[0];
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const headers = parseCsvLine(firstLine, delimiter);
  const dataRows = rows.slice(1).map((row) => {
    const values = parseCsvLine(row, delimiter);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });

  return {
    headers,
    rows: dataRows,
  };
};

const parseCsvFile = async (file: File): Promise<SheetData> => {
  const text = await file.text();
  return parseCsvText(text);
};

interface ManualReportLookupProps {
  bipados: string[];
}

export default function ManualReportLookup({ bipados }: ManualReportLookupProps) {
  const [sheets, setSheets] = useState<Record<SheetName, SheetData | null>>({
    Capa: null,
    Itens: null,
    "Notas Sem Remessa": null,
    "Notas de Remessa": null,
  });
  const [keyColumns, setKeyColumns] = useState<Record<SheetName, string>>({
    Capa: "",
    Itens: "",
    "Notas Sem Remessa": "",
    "Notas de Remessa": "",
  });
  const [valueColumns, setValueColumns] = useState<Record<SheetName, string>>({
    Capa: "",
    Itens: "",
    "Notas Sem Remessa": "",
    "Notas de Remessa": "",
  });
  const [results, setResults] = useState<
    Array<{
      chave: string;
      nf: string;
      sheetValues: Record<SheetName, string | null>;
    }>
  >([]);

  const handleFileChange = async (sheet: SheetName, file: File | null) => {
    setResults([]);

    if (!file) {
      setSheets((prev) => ({ ...prev, [sheet]: null }));
      setKeyColumns((prev) => ({ ...prev, [sheet]: "" }));
      setValueColumns((prev) => ({ ...prev, [sheet]: "" }));
      return;
    }

    try {
      const parsed = await parseCsvFile(file);
      if (parsed.headers.length === 0) {
        toast.error("Arquivo sem cabeçalhos válidos.");
        return;
      }

      setSheets((prev) => ({ ...prev, [sheet]: parsed }));
      setKeyColumns((prev) => ({ ...prev, [sheet]: parsed.headers[0] || "" }));
      setValueColumns((prev) => ({ ...prev, [sheet]: parsed.headers[1] || parsed.headers[0] || "" }));
      toast.success(`Aba ${sheet} carregada com ${parsed.rows.length} linha(s).`);
    } catch (error) {
      console.error("ManualReportLookup parse error:", error);
      toast.error("Erro ao ler o arquivo. Use CSV exportado do sistema.");
    }
  };

  const handleProcess = () => {
    if (bipados.length === 0) {
      toast.error("Nenhuma nota bipada. Primeiro faça a bipagem.");
      return;
    }

    const anySheetLoaded = sheetNames.some((name) => sheets[name] && sheets[name]?.rows.length > 0);
    if (!anySheetLoaded) {
      toast.error("Importe pelo menos uma aba antes de processar.");
      return;
    }

    const invalidSheet = sheetNames.find((name) => sheets[name] && (!keyColumns[name] || !valueColumns[name]));
    if (invalidSheet) {
      toast.error(`Selecione as colunas para a aba ${invalidSheet}.`);
      return;
    }

    const output = bipados.map((chave) => {
      const nf = extractNumeroNF(chave);
      return {
        chave,
        nf,
        sheetValues: sheetNames.reduce<Record<SheetName, string | null>>((acc, sheet) => {
          const sheetData = sheets[sheet];
          if (!sheetData || !keyColumns[sheet] || !valueColumns[sheet]) {
            acc[sheet] = null;
            return acc;
          }

          const match = sheetData.rows.find(
            (row) => String(row[keyColumns[sheet]] || "").trim() === nf.trim()
          );

          acc[sheet] = match ? String(match[valueColumns[sheet]] || "") : null;
          return acc;
        }, {} as Record<SheetName, string | null>),
      };
    });

    setResults(output);
  };

  const clearAll = () => {
    setSheets({
      Capa: null,
      Itens: null,
      "Notas Sem Remessa": null,
      "Notas de Remessa": null,
    });
    setKeyColumns({
      Capa: "",
      Itens: "",
      "Notas Sem Remessa": "",
      "Notas de Remessa": "",
    });
    setValueColumns({
      Capa: "",
      Itens: "",
      "Notas Sem Remessa": "",
      "Notas de Remessa": "",
    });
    setResults([]);
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Importação Manual de Relatórios</h2>
        <p className="text-sm text-muted-foreground">
          Importe as abas <strong>Capa</strong>, <strong>Itens</strong>, <strong>Notas Sem Remessa</strong> e <strong>Notas de Remessa</strong>.
          Depois selecione as colunas de NF e a coluna que deve ser retornada para cada aba.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {sheetNames.map((sheet) => (
          <div key={sheet} className="bg-secondary/70 border border-border rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-foreground mb-3">{sheet}</h3>
            <input
              type="file"
              accept=".csv,text/csv" 
              onChange={(event) => handleFileChange(sheet, event.target.files?.[0] ?? null)}
              className="mb-4 w-full text-sm text-foreground"
            />
            {sheets[sheet] ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Linhas: {sheets[sheet]?.rows.length}</p>
                <div className="grid grid-cols-1 gap-3">
                  <label className="block text-sm text-foreground">
                    Coluna do número da NF
                    <select
                      value={keyColumns[sheet]}
                      onChange={(event) => setKeyColumns((prev) => ({ ...prev, [sheet]: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      {sheets[sheet]?.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-foreground">
                    Coluna que precisa trazer
                    <select
                      value={valueColumns[sheet]}
                      onChange={(event) => setValueColumns((prev) => ({ ...prev, [sheet]: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      {sheets[sheet]?.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione o arquivo CSV exportado com a aba {sheet}.</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Notas bipadas: <strong>{bipados.length}</strong>. O número da NF é extraído dos 44 dígitos emitidos.
          </p>
          <p className="text-sm text-muted-foreground">Se não houver notas bipadas, primeiro realize a bipagem.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleProcess} className="bg-primary hover:bg-primary/90" disabled={bipados.length === 0}>
            Processar PROCV
          </Button>
          <Button variant="outline" onClick={clearAll}>
            Limpar importações
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 px-3 font-semibold text-foreground">NF</th>
                {sheetNames.map((sheet) => (
                  <th key={sheet} className="py-3 px-3 font-semibold text-foreground">{sheet}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((item) => (
                <tr key={`${item.chave}-${item.nf}`} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-3 font-medium text-foreground">{item.nf || item.chave}</td>
                  {sheetNames.map((sheet) => (
                    <td key={sheet} className="py-3 px-3 text-foreground">
                      {item.sheetValues[sheet] ?? <span className="text-red-400">Não encontrado</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
