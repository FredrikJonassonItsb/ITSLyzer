import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFileSelect?: (file: File, metadata: { organization: string; description?: string }) => void;
  isUploading?: boolean;
}

export function FileUpload({ onFileSelect, isUploading }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const excelFile = files.find(file => 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    );
    
    if (excelFile) {
      setSelectedFile(excelFile);
    } else {
      toast({
        title: 'Felaktig filtyp',
        description: 'Endast Excel-filer (.xlsx, .xls) stöds.',
        variant: 'destructive'
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile && organization.trim() && onFileSelect) {
      console.log('Uploading file:', selectedFile.name, 'for organization:', organization);
      onFileSelect(selectedFile, { organization: organization.trim(), description: description.trim() || undefined });
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importera Excel-fil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors hover-elevate ${
            isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          data-testid="file-drop-zone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-file"
          />
          
          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                data-testid="button-clear-file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-lg font-medium">Släpp din Excel-fil här</p>
                <p className="text-sm text-muted-foreground">
                  eller klicka för att välja fil (.xlsx, .xls)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organization">Organisation *</Label>
            <Input
              id="organization"
              placeholder="Ange organisationsnamn"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              data-testid="input-organization"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning (valfri)</Label>
            <Textarea
              id="description"
              placeholder="Tilläggsinformation om denna import..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="textarea-description"
            />
          </div>
        </div>

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !organization.trim() || isUploading}
          className="w-full"
          data-testid="button-upload"
        >
          {isUploading ? 'Importerar...' : 'Importera och analysera'}
        </Button>
      </CardContent>
    </Card>
  );
}