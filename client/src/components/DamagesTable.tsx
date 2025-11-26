import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Damage {
  type: string;
  amount: string;
}

interface DamagesTableProps {
  data: Damage[];
}

export function DamagesTable({ data }: DamagesTableProps) {
  const hasData = data && Array.isArray(data) && data.length > 0;

  return (
    <Card data-testid="section-damages">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-chart-3" />
          Damages & Penalties
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-4">
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={index} className="h-4" data-testid={`row-damage-${index}`}>
                    <TableCell className="text-sm">
                      {item.type}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-[100px] items-center justify-center rounded-md border-2 border-dashed border-border">
            <p className="text-sm text-muted-foreground">No damages or penalties found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
