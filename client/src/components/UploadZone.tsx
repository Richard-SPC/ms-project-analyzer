import { useCallback, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  className?: string;
}

export function UploadZone({ onFileSelect, className }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type === "application/pdf") {
          onFileSelect(file);
        }
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFileSelect(e.target.files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      className={cn(
        "relative min-h-64 rounded-lg border-2 border-dashed transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-accent/50",
        className
      )}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept="application/pdf"
        onChange={handleFileInput}
        data-testid="input-file-upload"
      />
      <label
        htmlFor="file-upload"
        className="flex h-full min-h-64 cursor-pointer flex-col items-center justify-center gap-4 p-6"
      >
        <div className="rounded-full bg-primary/10 p-4">
          {isDragging ? (
            <FileText className="h-8 w-8 text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-primary" />
          )}
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">
            {isDragging ? "Drop your contract here" : "Upload Contract"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag and drop your PDF file here, or click to browse
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Supports PDF files up to 10MB
          </p>
        </div>
      </label>
    </div>
  );
}
