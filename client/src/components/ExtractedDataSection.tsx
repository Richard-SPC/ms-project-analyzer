import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DataItem {
  label: string;
  value: string | null;
  confidence?: number;
}

interface ExtractedDataSectionProps {
  title: string;
  icon?: React.ReactNode;
  data: DataItem[];
  className?: string;
}

export function ExtractedDataSection({
  title,
  icon,
  data,
  className,
}: ExtractedDataSectionProps) {
  const hasData = data.some((item) => item.value !== null);

  return (
    <Card className={cn("", className)} data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-4">
            {data.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  {item.confidence && (
                    <Badge variant="secondary" className="text-xs">
                      {item.confidence}% confidence
                    </Badge>
                  )}
                </div>
                {item.value ? (
                  <p className="text-sm font-medium text-foreground">
                    {item.value}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Not found
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[100px] items-center justify-center rounded-md border-2 border-dashed border-border">
            <p className="text-sm text-muted-foreground">No data extracted</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
