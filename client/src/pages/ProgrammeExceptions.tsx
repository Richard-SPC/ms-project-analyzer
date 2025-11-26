import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { formatDateUK } from "@/lib/utils";
import type { Project } from "@shared/schema";
import Exceptions from "@/pages/Exceptions";

export default function ProgrammeExceptions() {
  const { data: allProgrammes, isLoading: programmesLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-exceptions-title">
          Holidays & Non-Working Days
        </h1>
        <p className="text-muted-foreground">
          Manage calendar exceptions for each programme
        </p>
      </div>

      <Card data-testid="card-programme-selection">
        <CardHeader>
          <CardTitle>Select Programme</CardTitle>
          <CardDescription>Choose a programme to manage its exceptions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedId && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Programme selected: {allProgrammes?.find(p => p.id === selectedId)?.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedId(null)}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md">
            {programmesLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Loading programmes...
              </div>
            ) : allProgrammes && allProgrammes.length > 0 ? (
              <>
                <div className="flex items-center gap-2 p-2 bg-muted font-semibold text-xs border-b sticky top-0">
                  <div className="w-5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground">Programme</p>
                  </div>
                  <div className="w-20 flex-shrink-0">
                    <p className="text-muted-foreground">Start Date</p>
                  </div>
                  <div className="w-20 flex-shrink-0">
                    <p className="text-muted-foreground">End Date</p>
                  </div>
                  <div className="w-20 flex-shrink-0">
                    <p className="text-muted-foreground">Status Date</p>
                  </div>
                </div>
                {allProgrammes.map((programme) => (
                  <div
                    key={programme.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => setSelectedId(programme.id)}
                    data-testid={`checkbox-programme-${programme.id}`}
                  >
                    <Checkbox
                      checked={selectedId === programme.id}
                      onCheckedChange={() => setSelectedId(selectedId === programme.id ? null : programme.id)}
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
                    <span className="w-20 text-xs text-muted-foreground flex-shrink-0 truncate">
                      {programme.startDate ? formatDateUK(programme.startDate) : '-'}
                    </span>
                    <span className="w-20 text-xs text-muted-foreground flex-shrink-0 truncate">
                      {programme.endDate ? formatDateUK(programme.endDate) : '-'}
                    </span>
                    <span className="w-20 text-xs text-muted-foreground flex-shrink-0 truncate">
                      {programme.statusDate ? formatDateUK(programme.statusDate) : '-'}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No programmes available
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedId && (
        <Exceptions projectId={selectedId} />
      )}
    </div>
  );
}
