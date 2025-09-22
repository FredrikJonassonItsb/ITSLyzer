import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, AlertCircle, Clock, FileSpreadsheet, Upload, Building, FileText } from 'lucide-react';

type ImportStage = 'upload' | 'parsing' | 'analyzing' | 'complete' | 'error';

interface ImportResult {
  totalRequirements: number;
  newRequirements: number;
  duplicates: number;
  categories: string[];
  organization: string;
  processingTime: number;
  aiGroupsFound?: number;
}

export function ImportPage() {
  const [currentStage, setCurrentStage] = useState<ImportStage>('upload');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !organization.trim()) {
      setErrorMessage('Välj en fil och ange organisation');
      return;
    }

    setIsUploading(true);
    setCurrentStage('parsing');
    setProgress(0);
    setImportResult(null);
    setErrorMessage('');

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('organization', organization.trim());
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Upload file
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import misslyckades');
      }

      const result = await response.json();
      
      setProgress(100);
      setCurrentStage('complete');
      setImportResult(result);
      
      // Reset form
      setSelectedFile(null);
      setOrganization('');
      setDescription('');
      
    } catch (error) {
      console.error('Import error:', error);
      setCurrentStage('error');
      setErrorMessage(error instanceof Error ? error.message : 'Okänt fel inträffade');
    } finally {
      setIsUploading(false);
    }
  };

  const resetImport = () => {
    setCurrentStage('upload');
    setProgress(0);
    setImportResult(null);
    setErrorMessage('');
    setSelectedFile(null);
    setOrganization('');
    setDescription('');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Importera Excel-fil</h1>
        <p className="text-muted-foreground">
          Ladda upp en Excel-fil med krav för analys och gruppering.
        </p>
      </div>

      {/* Main Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Upload className="h-6 w-6" />
            Filimport och analys
          </CardTitle>
          <CardDescription>
            Stöder .xlsx och .xls filer med svenska headers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Form */}
          {currentStage === 'upload' && (
            <div className="space-y-6">
              {/* File Selection */}
              <div className="space-y-2">
                <Label htmlFor="file-upload">Excel-fil *</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="input-file"
                  />
                  <Label 
                    htmlFor="file-upload" 
                    className="cursor-pointer text-sm font-medium hover:text-primary"
                  >
                    Klicka för att välja fil eller dra och släpp
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Endast .xlsx och .xls filer
                  </p>
                  {selectedFile && (
                    <div className="mt-3 p-2 bg-muted rounded flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4" />
                      {selectedFile.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Organization */}
              <div className="space-y-2">
                <Label htmlFor="organization">Organisation *</Label>
                <Input
                  id="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="T.ex. Karolinska Universitetssjukhuset"
                  data-testid="input-organization"
                />
                <p className="text-xs text-muted-foreground">
                  Namnet på organisationen som äger dessa krav
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Beskrivning (valfritt)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kortfattad beskrivning av vad som importeras..."
                  rows={3}
                  data-testid="textarea-description"
                />
              </div>

              {/* Upload Button */}
              <Button 
                onClick={handleUpload}
                disabled={!selectedFile || !organization.trim() || isUploading}
                className="w-full"
                data-testid="button-upload"
              >
                <Upload className="h-4 w-4 mr-2" />
                Starta import
              </Button>
            </div>
          )}

          {/* Progress States */}
          {(currentStage === 'parsing' || currentStage === 'analyzing') && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">
                  {currentStage === 'parsing' ? 'Läser Excel-fil...' : 'Analyserar krav...'}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Bearbetar {selectedFile?.name}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>

              <div className="text-sm text-muted-foreground">
                {currentStage === 'parsing' && (
                  <p>Identifierar kolumner och extraherar kravtext från Excel-filen...</p>
                )}
                {currentStage === 'analyzing' && (
                  <p>Analyserar krav och identifierar kategorier och duplikater...</p>
                )}
              </div>
            </div>
          )}

          {/* Success State */}
          {currentStage === 'complete' && importResult && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100">
                    Import slutförd!
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {importResult.totalRequirements} krav importerade från {importResult.organization}
                  </p>
                </div>
              </div>

              {/* Import Results */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{importResult.totalRequirements}</p>
                    <p className="text-sm text-muted-foreground">Totalt krav</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{importResult.newRequirements}</p>
                    <p className="text-sm text-muted-foreground">Nya krav</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600">{importResult.duplicates}</p>
                    <p className="text-sm text-muted-foreground">Duplikater</p>
                  </CardContent>
                </Card>
              </div>

              {/* Categories */}
              {importResult.categories.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Identifierade kategorier:</h4>
                  <div className="flex flex-wrap gap-2">
                    {importResult.categories.map(category => (
                      <Badge key={category} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Button 
                  onClick={() => window.location.href = '/requirements'}
                  className="flex-1"
                  data-testid="button-view-requirements"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Se importerade krav
                </Button>
                
                <Button variant="outline" onClick={resetImport}>
                  Importera fler
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {currentStage === 'error' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <h4 className="font-medium text-red-900 dark:text-red-100">
                    Import misslyckades
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {errorMessage}
                  </p>
                </div>
              </div>

              <Button variant="outline" onClick={resetImport} className="w-full">
                Försök igen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instruktioner för Excel-filer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Obligatoriska kolumner:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Kravtext eller liknande</li>
                <li>• Organisation eller Kund</li>
                <li>• Krav-ID eller identifierare</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Valfria kolumner:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Kravtyp (Skall/Bör)</li>
                <li>• Kategori eller Område</li>
                <li>• Kommentarer</li>
                <li>• Status eller Bedömning</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm">
              <strong>Tips:</strong> Systemet identifierar automatiskt svenska kolumnnamn som 
              "Krav", "Kravtext", "Beskrivning", "Organisation", "Kund", "Typ", etc.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ImportPage;