import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, Shield, BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react';
import './Dropzone.css';

interface DropzoneProps {
  onFilesDropped: (files: File[]) => void;
}

const ARQUIVOS_INFO = [
  {
    sigla: 'MSC',
    nome: 'Matriz de Saldos Contábeis',
    formato: '.csv ou .zip',
    obrigatorio: true,
    habilita: 'D1 + D2 + Relatórios de Execução',
    cor: '#2563eb',
  },
  {
    sigla: 'RREO',
    nome: 'Rel. Resumido de Exec. Orçamentária',
    formato: '.xls, .xlsx, .xml ou .zip',
    obrigatorio: false,
    habilita: 'D3 + D4 (cruzamento com MSC)',
    cor: '#16a34a',
  },
  {
    sigla: 'RGF',
    nome: 'Relatório de Gestão Fiscal',
    formato: '.xls, .xlsx, .xml ou .zip',
    obrigatorio: false,
    habilita: 'D3 fiscal (RCL e DCL cruzados)',
    cor: '#d97706',
  },
  {
    sigla: 'DCA',
    nome: 'Declaração de Contas Anuais',
    formato: '.xls, .xlsx, .xml ou .zip',
    obrigatorio: false,
    habilita: 'D2 avançado (MSC × DCA)',
    cor: '#7c3aed',
  },
];

export default function Dropzone({ onFilesDropped }: DropzoneProps) {
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
      setError('Por favor, envie arquivos nos formatos: CSV, ZIP, XML, XLS ou XLSX.');
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

  return (
    <div className="dropzone-container animate-fade-in">

      {/* Área de upload */}
      <div
        className={`dropzone-area glass-panel ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <UploadCloud className="upload-icon" size={56} />
        <h3>Arraste e solte seus arquivos aqui</h3>
        <p className="dropzone-sub">
          Envie <strong>um ou mais arquivos juntos</strong> para cobertura máxima das validações.
          Aceitos: <strong>CSV, ZIP, XML, XLS, XLSX</strong>.
        </p>
        <input
          type="file"
          multiple
          accept=".csv,.zip,.xml,.xls,.xlsx"
          id="file-upload"
          className="file-input"
          onChange={handleFileInput}
        />
        <label htmlFor="file-upload" className="upload-btn">
          Selecionar Arquivos
        </label>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Painel explicativo de cobertura */}
      <div className="coverage-panel glass-panel">
        <div className="coverage-header">
          <BarChart3 size={18} className="coverage-header-icon" />
          <span>Cobertura por arquivo — envie todos juntos para validação completa</span>
        </div>
        <div className="coverage-grid">
          {ARQUIVOS_INFO.map(a => (
            <div key={a.sigla} className="coverage-card">
              <div className="coverage-card-top">
                <span className="coverage-sigla" style={{ borderColor: a.cor, color: a.cor }}>{a.sigla}</span>
                {a.obrigatorio
                  ? <span className="coverage-badge coverage-badge-req">Obrigatório</span>
                  : <span className="coverage-badge coverage-badge-opt">Opcional</span>
                }
              </div>
              <p className="coverage-nome">{a.nome}</p>
              <p className="coverage-formato">{a.formato}</p>
              <div className="coverage-habilita">
                <CheckCircle2 size={12} style={{ color: a.cor, flexShrink: 0, marginTop: 1 }} />
                <span>Habilita: {a.habilita}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="coverage-tip">
          💡 <strong>Dica:</strong> selecione os quatro arquivos de uma vez na mesma janela de upload
          — o sistema identifica cada um automaticamente pelo nome e executa todos os cruzamentos disponíveis.
        </p>
      </div>

      {/* Cards de features */}
      <div className="features-grid">
        <div className="feature-card glass-panel">
          <Shield className="feature-icon" size={24} />
          <h4>Processamento Local</h4>
          <p>Seus dados são lidos apenas no seu navegador. Nenhum arquivo é enviado a servidores.</p>
        </div>
        <div className="feature-card glass-panel">
          <FileText className="feature-icon capag" size={24} />
          <h4>Foco no CAPAG</h4>
          <p>Identificamos erros críticos que afetam a nota CAPAG e o Ranking ICF do município.</p>
        </div>
      </div>
    </div>
  );
}
