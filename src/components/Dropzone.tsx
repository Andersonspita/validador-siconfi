import React, { useCallback, useState } from 'react';
import {
  UploadCloud, AlertCircle, CheckCircle2, FileSpreadsheet, Receipt,
  Wallet, FileUp, Shield, Bell
} from 'lucide-react';
import './Dropzone.css';

interface DropzoneProps {
  onFilesDropped: (files: File[]) => void;
  files?: File[];
  onReset?: () => void;
  onGoValidacoes?: () => void;
}

const ARQUIVOS_INFO = [
  {
    key: 'msc',
    sigla: 'MSC',
    nome: 'MSC - Matriz de Saldos',
    tag: 'Base Principal',
    formato: '.csv ou .zip',
    match: (n: string) => n.includes('msc') || n.endsWith('.csv'),
    icon: FileSpreadsheet,
    habilita: 'D1 + D2 + Relatórios de Execução',
  },
  {
    key: 'rreo',
    sigla: 'RREO',
    nome: 'RREO (Anexos 1 a 14)',
    tag: 'Cruzamento D3',
    formato: '.xls, .xlsx, .xml ou .zip',
    match: (n: string) => n.includes('rreo'),
    icon: Receipt,
    habilita: 'D3 + D4 (cruzamento com MSC)',
  },
  {
    key: 'rgf',
    sigla: 'RGF',
    nome: 'RGF (Poder Executivo)',
    tag: 'Gestão Fiscal LRF',
    formato: '.xls, .xlsx, .xml ou .zip',
    match: (n: string) => n.includes('rgf'),
    icon: Wallet,
    habilita: 'D3 fiscal (RCL e DCL cruzados)',
  },
  {
    key: 'dca',
    sigla: 'DCA',
    nome: 'DCA - Declaração Anual',
    tag: 'Complementar',
    formato: '.xls, .xlsx, .xml ou .zip',
    match: (n: string) => n.includes('dca'),
    icon: FileUp,
    habilita: 'D2 avançado (MSC × DCA)',
  },
];

function classifyFile(file: File) {
  const n = file.name.toLowerCase();
  return ARQUIVOS_INFO.find(a => a.match(n));
}

export default function Dropzone({ onFilesDropped, files = [], onReset, onGoValidacoes }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter(f =>
      f.name.endsWith('.csv') || f.name.endsWith('.zip') ||
      f.name.endsWith('.xml') || f.name.endsWith('.xls') || f.name.endsWith('.xlsx')
    );
    if (validFiles.length === 0) {
      setError('Envie arquivos nos formatos: CSV, ZIP, XML, XLS ou XLSX.');
      return;
    }
    setError(null);
    onFilesDropped(validFiles);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(e.target.files);
  };

  const loadedByType = ARQUIVOS_INFO.map(a => {
    const found = files.find(f => a.match(f.name.toLowerCase()));
    return { ...a, file: found };
  });

  const loadedCount = loadedByType.filter(a => a.file).length;

  return (
    <div className="dropzone-container animate-fade-in">
      {/* Alerta institucional */}
      <section className="panel alert-bar">
        <div className="alert-bar-left">
          <div className="alert-icon">
            <Bell size={22} />
          </div>
          <div>
            <div className="alert-title-row">
              <h2>Pré-validação Siconfi — remessa MSC / RREO / RGF / DCA</h2>
              <span className="status-pill danger">Obrigatório</span>
            </div>
            <p>
              Carregue os demonstrativos para antecipar inconsistências D1–D4 antes da homologação no Siconfi.
              O processamento ocorre <strong>somente no navegador</strong>.
            </p>
          </div>
        </div>
        <div className="alert-bar-actions">
          {onReset && (
            <button type="button" className="inst-btn" onClick={onReset}>
              Nova carga
            </button>
          )}
          {onGoValidacoes && (
            <button type="button" className="inst-btn inst-btn-primary" onClick={onGoValidacoes}>
              <Shield size={16} />
              Ver Pré-Validação
            </button>
          )}
        </div>
      </section>

      {/* Matriz de carga */}
      <section className="panel panel-pad carga-panel">
        <div className="carga-header">
          <div>
            <h3>Matriz de Carga de Demonstrativos Fiscais</h3>
            <p>Arquivos para cruzamento de consistência orçamentária e patrimonial (D1 a D4).</p>
          </div>
          <div className="carga-coverage">
            <span>Arquivos detectados:</span>
            <strong>{loadedCount}/4</strong>
            {loadedCount > 0 && (
              <span className="status-pill success">{Math.round((loadedCount / 4) * 100)}% carga</span>
            )}
          </div>
        </div>

        <div
          className={`dropzone-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadCloud size={36} className="upload-icon" />
          <div className="dropzone-copy">
            <strong>Arraste e solte os arquivos aqui</strong>
            <span>Ou selecione MSC, RREO, RGF e DCA juntos — CSV, ZIP, XML, XLS, XLSX</span>
          </div>
          <input
            type="file"
            multiple
            accept=".csv,.zip,.xml,.xls,.xlsx"
            id="file-upload"
            className="file-input"
            onChange={handleFileInput}
          />
          <label htmlFor="file-upload" className="inst-btn inst-btn-primary">
            Selecionar Arquivos
          </label>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="coverage-grid">
          {loadedByType.map(a => {
            const Icon = a.icon;
            const loaded = !!a.file;
            return (
              <div key={a.key} className={`coverage-card ${loaded ? 'loaded' : 'pending'}`}>
                <div className="coverage-card-top">
                  <span className="coverage-tag">{a.tag}</span>
                  {loaded ? (
                    <span className="status-inline success">
                      <CheckCircle2 size={14} /> Processado
                    </span>
                  ) : (
                    <span className="status-inline pending">Pendente</span>
                  )}
                </div>
                <div className="coverage-title">
                  <Icon size={18} />
                  <span>{a.nome}</span>
                </div>
                {loaded && a.file ? (
                  <>
                    <div className="coverage-file" title={a.file.name}>{a.file.name}</div>
                    <div className="coverage-foot">
                      <span>{(a.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                      <span className="mono">{a.sigla}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="coverage-file muted">{a.habilita}</div>
                    <div className="coverage-foot">
                      <span>{a.formato}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="trust-strip">
          <div className="trust-item">
            <Shield size={18} />
            <div>
              <strong>Processamento local</strong>
              <p>Dados fiscais não saem do navegador.</p>
            </div>
          </div>
          <div className="trust-item">
            <FileSpreadsheet size={18} />
            <div>
              <strong>Foco CAPAG / Ranking ICF</strong>
              <p>Erros críticos destacados para correção antes da remessa.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// export helper for other modules if needed
export { classifyFile, ARQUIVOS_INFO };
