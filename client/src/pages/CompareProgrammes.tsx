import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { formatDateUK } from "@/lib/utils";
import type { Project } from "@shared/schema";

export default function CompareProgrammes() {
  const { data: allProgrammes, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const selectedProgrammes = useMemo(() => {
    if (!allProgrammes) return [];
    return allProgrammes.filter(p => selectedIds.includes(p.id));
  }, [allProgrammes, selectedIds]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-compare-title">
          Compare Programmes
        </h1>
        <p className="text-muted-foreground">
          Select up to 5 programmes to compare their details side-by-side
        </p>
      </div>

      <Card data-testid="card-programme-selection">
        <CardHeader>
          <CardTitle>Select Programmes</CardTitle>
          <CardDescription>Choose programmes to compare</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} programme{selectedIds.length !== 1 ? "s" : ""} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allProgrammes && allProgrammes.length > 0 ? (
              allProgrammes.map((programme) => (
                <div
                  key={programme.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => selectedIds.length < 5 && toggleSelection(programme.id)}
                  data-testid={`checkbox-programme-${programme.id}`}
                >
                  <Checkbox
                    checked={selectedIds.includes(programme.id)}
                    disabled={!selectedIds.includes(programme.id) && selectedIds.length >= 5}
                    onCheckedChange={() => toggleSelection(programme.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {programme.name}
                    </p>
                    {programme.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {programme.description}
                      </p>
                    )}
                  </div>
                  {programme.statusDate && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDateUK(programme.statusDate)}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No programmes available
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedProgrammes.length > 0 && (
        <Card data-testid="card-comparison-table">
          <CardHeader>
            <CardTitle>Comparison</CardTitle>
            <CardDescription>
              Comparing {selectedProgrammes.length} programme{selectedProgrammes.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    {selectedProgrammes.map((prog) => (
                      <TableHead key={prog.id} data-testid={`header-programme-${prog.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{prog.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => toggleSelection(prog.id)}
                            data-testid={`button-remove-${prog.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Name</TableCell>
                    {selectedProgrammes.map((prog) => (
                      <TableCell key={prog.id} data-testid={`cell-name-${prog.id}`}>
                        {prog.name}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Description</TableCell>
                    {selectedProgrammes.map((prog) => (
                      <TableCell key={prog.id} data-testid={`cell-description-${prog.id}`}>
                        {prog.description || "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Status Date</TableCell>
                    {selectedProgrammes.map((prog) => (
                      <TableCell key={prog.id} data-testid={`cell-status-date-${prog.id}`}>
                        {prog.statusDate ? formatDateUK(prog.statusDate) : "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Status</TableCell>
                    {selectedProgrammes.map((prog) => (
                      <TableCell key={prog.id} data-testid={`cell-status-${prog.id}`}>
                        <Badge variant={prog.status === "active" ? "default" : "secondary"}>
                          {prog.status}
                        </Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Project Manager</TableCell>
                    {selectedProgrammes.map((prog) => (
                      <TableCell key={prog.id} data-testid={`cell-project-manager-${prog.id}`}>
                        {prog.projectManager || "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Start Date</TableCell>
                    {selectedProgrammes.map((prog) => (
                      <TableCell key={prog.id} data-testid={`cell-start-date-${prog.id}`}>
                        {prog.startDate ? formatDateUK(prog.startDate) : "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">End Date</TableCell>
                    {selectedProgrammes.map((prog) => (
                      <TableCell key={prog.id} data-testid={`cell-end-date-${prog.id}`}>
                        {prog.endDate ? formatDateUK(prog.endDate) : "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
