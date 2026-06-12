import React, { useCallback, useState } from 'react';
import { UploadCloud, FileType, AlertCircle } from 'lucide-react';
import './Dropzone.css';

interface DropzoneProps {
  onFilesDropped: (files: File[]) => void;
}

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
      f.name.endsWith('.csv') || f.name.endsWith('.zip') || f.name.endsWith('.xml')
    );
    
    if (validFiles.length === 0) {
      setError("Por favor, envie apenas arquivos CSV (MSC) ou ZIP/XML (RREO, RGF, DCA).");
      return;
    }
    
    setError(null);
    onFilesDropped(validFiles);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  return (
    <div className="dropzone-container animate-fade-in">
      <div 
        className={`dropzone-area glass-panel ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <UploadCloud className="upload-icon" size={64} />
        <h3>Arraste e solte seus arquivos aqui</h3>
        <p>Ou clique para selecionar. Aceitamos arquivos da <strong>MSC (.csv)</strong>, e <strong>RREO/RGF/DCA (.zip, .xml)</strong>.</p>
        
        <input 
          type="file" 
          multiple 
          accept=".csv,.zip,.xml" 
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
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="features-grid">
        <div className="feature-card glass-panel">
          <FileType className="feature-icon" size={24} />
          <h4>Processamento Local</h4>
          <p>Seus dados são lidos apenas no seu navegador. Segurança total.</p>
        </div>
        <div className="feature-card glass-panel">
          <AlertCircle className="feature-icon capag" size={24} />
          <h4>Foco no CAPAG</h4>
          <p>Identificamos erros críticos que afetam a nota do seu município.</p>
        </div>
      </div>
    </div>
  );
}
