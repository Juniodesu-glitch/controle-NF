import fs from 'fs';
import path from 'path';
import os from 'os';

// Caminho para arquivo de configurações (na raiz do projeto)
const SETTINGS_FILE = path.join(process.cwd(), 'app-settings.json');

export interface AppSettings {
  nfSourcePath: string;
  nfSourceType: 'local' | 'network' | 'onedrive-pattern';
  lastUpdated: string;
  updatedBy?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  nfSourcePath: '',
  nfSourceType: 'local',
  lastUpdated: new Date().toISOString(),
};

/**
 * Carrega as configurações do arquivo JSON
 */
export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data) as AppSettings;
    }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Salva as configurações no arquivo JSON
 */
export function saveSettings(settings: AppSettings): void {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    throw error;
  }
}

/**
 * Valida se o caminho existe e é acessível
 */
export function validatePath(pathToCheck: string): {
  valid: boolean;
  error?: string;
  fileCount?: number;
} {
  try {
    // Expandir variáveis de ambiente
    const expandedPath = expandPath(pathToCheck);

    if (!fs.existsSync(expandedPath)) {
      return { valid: false, error: `Caminho não encontrado: ${expandedPath}` };
    }

    const stat = fs.statSync(expandedPath);
    if (!stat.isDirectory()) {
      return { valid: false, error: 'Caminho não é uma pasta' };
    }

    // Contar XMLs recursivamente
    const fileCount = countXmlFiles(expandedPath);
    return { valid: true, fileCount };
  } catch (error) {
    return { valid: false, error: `Erro ao validar: ${error}` };
  }
}

/**
 * Expande variáveis de ambiente e padrões OneDrive
 */
export function expandPath(pathStr: string): string {
  let expanded = pathStr;

  // Expandir %USERPROFILE%, %APPDATA%, etc
  Object.entries(process.env).forEach(([key, value]) => {
    if (value) {
      expanded = expanded.replace(`%${key}%`, value);
      expanded = expanded.replace(`$${key}`, value);
    }
  });

  // Se for um padrão OneDrive genérico
  if (expanded.includes('*') || expanded.includes('Capric')) {
    const userProfile = process.env.USERPROFILE || os.homedir();
    // Procura por padrões tipo: User\Capric*\LOGISTICA...\nf-app
    const parts = expanded.split(path.sep);
    const resolvedParts: string[] = [];

    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part.includes('*') || part.includes('Capric')) {
        // Se a pasta raiz for %USERPROFILE% ou c:\Users\NomeUser
        if (resolvedParts.length === 0) {
          resolvedParts.push(userProfile);
        }
        // Tenta encontrar a pasta que corresponde ao padrão
        try {
          const parent = resolvedParts[resolvedParts.length - 1];
          const entries = fs.readdirSync(parent);
          const matched = entries.find(e => {
            const normalized = e.toLowerCase();
            return normalized.includes('capric') || normalized.includes(part.toLowerCase());
          });
          if (matched) {
            resolvedParts.push(matched);
          } else {
            resolvedParts.push(part);
          }
        } catch {
          resolvedParts.push(part);
        }
      } else {
        resolvedParts.push(part);
      }
    }

    expanded = resolvedParts.join(path.sep);
  }

  return expanded;
}

/**
 * Conta quantos arquivos XML existem em uma pasta recursivamente
 */
function countXmlFiles(dir: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += countXmlFiles(path.join(dir, entry.name));
      } else if (entry.name.toLowerCase().endsWith('.xml')) {
        count++;
      }
    }
  } catch {
    // Ignorar erros de acesso
  }
  return count;
}

/**
 * Retorna o caminho raiz expandido
 */
export function getExpandedNfSourcePath(): string {
  const settings = loadSettings();
  if (!settings.nfSourcePath) {
    throw new Error('NF_SOURCE_PATH não configurado');
  }
  return expandPath(settings.nfSourcePath);
}

/**
 * Lista caminhos OneDrive conhecidos no sistema (para sugerir)
 */
export function suggestOnedrivePaths(): string[] {
  const suggestions: string[] = [];
  const userProfile = process.env.USERPROFILE || os.homedir();

  try {
    const entries = fs.readdirSync(userProfile);
    entries.forEach(entry => {
      if (entry.toLowerCase().includes('onedrive')) {
        const fullPath = path.join(userProfile, entry);
        try {
          if (fs.statSync(fullPath).isDirectory()) {
            const logisticaPath = path.join(fullPath, 'LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos', 'nf-app');
            if (fs.existsSync(logisticaPath)) {
              suggestions.push(logisticaPath);
            }
          }
        } catch {
          // Ignorar
        }
      }
    });
  } catch {
    // Ignorar
  }

  return suggestions;
}
