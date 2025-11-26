import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CompletionDate {
  section: string;
  completionDate: string;
}

interface CompletionDatesTableProps {
  data: CompletionDate[];
}

export function CompletionDatesTable({ data }: CompletionDatesTableProps) {
  const hasData = data && Array.isArray(data) && data.length > 0;

  return (
    <Card data-testid="section-completion-dates">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Completion Dates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-4">
                  <TableHead className="font-semibold py-0">Section</TableHead>
                  <TableHead className="font-semibold py-0">Completion Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={index} className="h-4" data-testid={`row-completion-date-${index}`}>
                    <TableCell className="text-sm py-0">
                      {item.section}
                    </TableCell>
                    <TableCell className="text-sm py-0">
                      {item.completionDate}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-[100px] items-center justify-center rounded-md border-2 border-dashed border-border">
            <p className="text-sm text-muted-foreground">No completion dates found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
