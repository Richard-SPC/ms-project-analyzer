import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Calendar, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateUK } from "@/lib/utils";
import type { Project, CalendarException, PublicHoliday } from "@shared/schema";
import Exceptions from "@/pages/Exceptions";
import { Badge } from "@/components/ui/badge";

export default function ProgrammeExceptions() {
  const { data: allProgrammes, isLoading: programmesLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [holidayCountry, setHolidayCountry] = useState<"scotland" | "england">("scotland");
  const [programmeSearch, setProgrammeSearch] = useState("");

  const selectedProgramme = selectedId ? allProgrammes?.find((p) => p.id === selectedId) : null;

  const { data: exceptions = [] } = useQuery<CalendarException[]>({
    queryKey: ["/api/projects", selectedId, "exceptions"],
    enabled: !!selectedId,
  });

  const { data: holidays = [], isLoading: holidaysLoading } = useQuery<PublicHoliday[]>({
    queryKey: ["/api/public-holidays", holidayCountry],
    queryFn: () => fetch(`/api/public-holidays?country=${holidayCountry}`).then(r => r.json()),
  });

  const getHolidayStatus = (holiday: PublicHoliday): "red" | "green" | "none" => {
    if (!selectedProgramme) return "none";
    if (!selectedProgramme.startDate || !selectedProgramme.endDate) return "none";

    const start = new Date(selectedProgramme.startDate);
    const end = new Date(selectedProgramme.endDate);
    const holidayDate = new Date(holiday.date);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    holidayDate.setHours(0, 0, 0, 0);

    const isInProgrammeRange = holidayDate >= start && holidayDate <= end;
    if (!isInProgrammeRange) return "none";

    const isListed = exceptions.some((exc) => {
      const excStart = new Date(exc.startDate);
      const excEnd = new Date(exc.endDate);
      excStart.setHours(0, 0, 0, 0);
      excEnd.setHours(23, 59, 59, 999);
      return holidayDate >= excStart && holidayDate <= excEnd;
    });

    return isListed ? "green" : "red";
  };

  const holidayStatuses = selectedProgramme ? holidays.map(getHolidayStatus) : [];
  const redCount = holidayStatuses.filter(s => s === "red").length;
  const greenCount = holidayStatuses.filter(s => s === "green").length;

  // Group holidays by year for display
  const holidaysByYear = useMemo(() => {
    return holidays.reduce((acc, h) => {
      const year = new Date(h.date).getFullYear();
      if (!acc[year]) acc[year] = [];
      acc[year].push(h);
      return acc;
    }, {} as Record<number, PublicHoliday[]>);
  }, [holidays]);

  const years = Object.keys(holidaysByYear).map(Number).sort();

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-exceptions-title">
          Holidays & Non-Working Days
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage calendar exceptions for each programme
        </p>
      </div>

      <Card data-testid="card-scotland-holidays">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <CardTitle className="text-sm">
                {holidayCountry === "scotland" ? "Scotland" : "England"} Public Holidays
              </CardTitle>
              <div className="flex gap-1 ml-4">
                <Button
                  size="sm"
                  variant={holidayCountry === "scotland" ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => setHolidayCountry("scotland")}
                  data-testid="button-scotland-holidays"
                >
                  Scotland
                </Button>
                <Button
                  size="sm"
                  variant={holidayCountry === "england" ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => setHolidayCountry("england")}
                  data-testid="button-england-holidays"
                >
                  England
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {redCount > 0 && (
                <Badge className="text-xs bg-red-500 text-white" data-testid="badge-red-holidays">
                  {redCount} not listed
                </Badge>
              )}
              {greenCount > 0 && (
                <Badge className="text-xs bg-green-600 text-white" data-testid="badge-green-holidays">
                  {greenCount} listed
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-1 px-4 pb-2">
          {holidaysLoading ? (
            <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Loading holidays...</div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              No holidays configured. Visit Holiday Settings to add them.
            </div>
          ) : (
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(years.length, 5)}, 1fr)` }}>
              {years.map((year) => (
                <div key={year} className="space-y-0.5">
                  <p className="font-semibold text-xs text-foreground mb-1">{year}</p>
                  <div className="space-y-0.5">
                    {(holidaysByYear[year] || []).map((holiday, idx) => {
                      const status = getHolidayStatus(holiday);
                      const bgColors = {
                        red: "bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-700",
                        green: "bg-green-100 dark:bg-green-950 border border-green-300 dark:border-green-700",
                        none: "",
                      };
                      const textColors = {
                        red: "text-red-900 dark:text-red-100",
                        green: "text-green-900 dark:text-green-100",
                        none: "text-muted-foreground",
                      };
                      return (
                        <div
                          key={`${holiday.id}-${idx}`}
                          className={`text-xs p-0.5 rounded transition-colors ${bgColors[status]}`}
                          data-testid={`row-holiday-${holiday.id}`}
                        >
                          <p className="font-medium text-foreground leading-none text-xs">{holiday.name}</p>
                          <p className={`leading-none font-medium text-xs ${textColors[status]}`}>
                            {formatDateUK(new Date(holiday.date))}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-programme-selection">
        <CardHeader className="py-2">
          <CardTitle className="text-sm">Select Programme</CardTitle>
          <CardDescription className="text-xs">Choose a programme to manage its exceptions</CardDescription>
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search programmes..."
              value={programmeSearch}
              onChange={(e) => setProgrammeSearch(e.target.value)}
              className="pl-9"
              data-testid="input-programme-search"
            />
          </div>

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
                {allProgrammes
                  .filter(p => p.name.toLowerCase().includes(programmeSearch.toLowerCase()))
                  .map((programme) => (
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
