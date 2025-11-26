import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const hasData = data && Array.isArray(data) && data.some((item) => item.value !== null);

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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-4">
                  <TableHead className="w-[30%]">Field</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[120px] text-right">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={index} className="h-4" data-testid={`row-${title.toLowerCase().replace(/\s+/g, '-')}-${index}`}>
                    <TableCell className="font-medium text-sm">
                      {item.label}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.value ? (
                        <span className="text-foreground">{item.value}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Not found</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.confidence && item.confidence > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {item.confidence}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
