import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoorOpen } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AccessDate {
  partOfSite: string;
  date: string;
}

interface AccessDatesTableProps {
  data: AccessDate[];
}

export function AccessDatesTable({ data }: AccessDatesTableProps) {
  const hasData = data && Array.isArray(data) && data.length > 0;

  return (
    <Card data-testid="section-access-dates">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <DoorOpen className="h-5 w-5 text-primary" />
          Access Dates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Part of the Site</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={index} data-testid={`row-access-date-${index}`}>
                    <TableCell className="text-sm">
                      {item.partOfSite}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.date}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-[100px] items-center justify-center rounded-md border-2 border-dashed border-border">
            <p className="text-sm text-muted-foreground">No access dates found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
