import FileUpload from '../file-upload';

export default function FileUploadExample() {
  const handleFileSelect = (file: File, metadata: { organization: string; description?: string }) => {
    console.log('File selected:', file.name, 'Metadata:', metadata);
  };

  return (
    <div className="p-6">
      <FileUpload onFileSelect={handleFileSelect} isUploading={false} />
    </div>
  );
}