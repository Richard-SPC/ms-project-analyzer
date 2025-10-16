import { FileText, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FilePreviewCardProps {
  fileName: string;
  fileSize: string;
  status?: "uploading" | "processing" | "complete" | "error";
  onRemove?: () => void;
  className?: string;
}

export function FilePreviewCard({
  fileName,
  fileSize,
  status = "complete",
  onRemove,
  className,
}: FilePreviewCardProps) {
  return (
    <Card
      className={cn(
        "flex items-center gap-3 p-4",
        status === "complete" && "border-l-4 border-l-chart-2",
        className
      )}
      data-testid="card-file-preview"
    >
      <div className="rounded-md bg-primary/10 p-2">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {fileName}
        </p>
        <p className="text-xs text-muted-foreground">{fileSize}</p>
      </div>
      {status === "complete" && (
        <CheckCircle2 className="h-5 w-5 text-chart-2 flex-shrink-0" />
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          data-testid="button-remove-file"
          className="flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}
