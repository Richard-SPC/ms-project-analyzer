import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Calendar, AlertCircle } from "lucide-react";
import { formatDateUK } from "@/lib/utils";
import type { Project, CalendarException } from "@shared/schema";
import Exceptions from "@/pages/Exceptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const SCOTLAND_HOLIDAYS = [
  // 2025
  { name: "New Year's Day", date: new Date(2025, 0, 1) },
  { name: "2 January", date: new Date(2025, 0, 2) },
  { name: "Good Friday", date: new Date(2025, 3, 18) },
  { name: "Easter Monday", date: new Date(2025, 3, 21) },
  { name: "Early May Bank Holiday", date: new Date(2025, 4, 5) },
  { name: "Spring Bank Holiday", date: new Date(2025, 4, 26) },
  { name: "Summer Bank Holiday", date: new Date(2025, 7, 4) },
  { name: "St Andrew's Day", date: new Date(2025, 10, 30) },
  { name: "Christmas Day", date: new Date(2025, 11, 25) },
  { name: "Boxing Day", date: new Date(2025, 11, 26) },
  // 2026
  { name: "New Year's Day", date: new Date(2026, 0, 1) },
  { name: "2 January", date: new Date(2026, 0, 2) },
  { name: "Good Friday", date: new Date(2026, 3, 3) },
  { name: "Easter Monday", date: new Date(2026, 3, 6) },
  { name: "Early May Bank Holiday", date: new Date(2026, 4, 4) },
  { name: "Spring Bank Holiday", date: new Date(2026, 4, 25) },
  { name: "Summer Bank Holiday", date: new Date(2026, 7, 3) },
  { name: "St Andrew's Day", date: new Date(2026, 10, 30) },
  { name: "Christmas Day", date: new Date(2026, 11, 25) },
  { name: "Boxing Day", date: new Date(2026, 11, 28) },
  // 2027
  { name: "New Year's Day", date: new Date(2027, 0, 1) },
  { name: "2 January", date: new Date(2027, 0, 4) },
  { name: "Good Friday", date: new Date(2027, 3, 26) },
  { name: "Easter Monday", date: new Date(2027, 3, 29) },
  { name: "Early May Bank Holiday", date: new Date(2027, 4, 3) },
  { name: "Spring Bank Holiday", date: new Date(2027, 4, 31) },
  { name: "Summer Bank Holiday", date: new Date(2027, 7, 2) },
  { name: "St Andrew's Day", date: new Date(2027, 10, 30) },
  { name: "Christmas Day", date: new Date(2027, 11, 25) },
  { name: "Boxing Day", date: new Date(2027, 11, 28) },
  // 2028
  { name: "New Year's Day", date: new Date(2028, 0, 1) },
  { name: "2 January", date: new Date(2028, 0, 3) },
  { name: "Good Friday", date: new Date(2028, 3, 14) },
  { name: "Easter Monday", date: new Date(2028, 3, 17) },
  { name: "Early May Bank Holiday", date: new Date(2028, 4, 1) },
  { name: "Spring Bank Holiday", date: new Date(2028, 4, 29) },
  { name: "Summer Bank Holiday", date: new Date(2028, 7, 7) },
  { name: "St Andrew's Day", date: new Date(2028, 10, 30) },
  { name: "Christmas Day", date: new Date(2028, 11, 25) },
  { name: "Boxing Day", date: new Date(2028, 11, 26) },
  // 2029
  { name: "New Year's Day", date: new Date(2029, 0, 1) },
  { name: "2 January", date: new Date(2029, 0, 2) },
  { name: "Good Friday", date: new Date(2029, 3, 30) },
  { name: "Easter Monday", date: new Date(2029, 4, 2) },
  { name: "Early May Bank Holiday", date: new Date(2029, 4, 7) },
  { name: "Spring Bank Holiday", date: new Date(2029, 5, 28) },
  { name: "Summer Bank Holiday", date: new Date(2029, 7, 6) },
  { name: "St Andrew's Day", date: new Date(2029, 10, 30) },
  { name: "Christmas Day", date: new Date(2029, 11, 25) },
  { name: "Boxing Day", date: new Date(2029, 11, 26) },
];

const ENGLAND_HOLIDAYS = [
  // 2025
  { name: "New Year's Day", date: new Date(2025, 0, 1) },
  { name: "Good Friday", date: new Date(2025, 3, 18) },
  { name: "Easter Monday", date: new Date(2025, 3, 21) },
  { name: "Early May Bank Holiday", date: new Date(2025, 4, 5) },
  { name: "Spring Bank Holiday", date: new Date(2025, 4, 26) },
  { name: "Summer Bank Holiday", date: new Date(2025, 7, 25) },
  { name: "Christmas Day", date: new Date(2025, 11, 25) },
  { name: "Boxing Day", date: new Date(2025, 11, 26) },
  // 2026
  { name: "New Year's Day", date: new Date(2026, 0, 1) },
  { name: "Good Friday", date: new Date(2026, 3, 3) },
  { name: "Easter Monday", date: new Date(2026, 3, 6) },
  { name: "Early May Bank Holiday", date: new Date(2026, 4, 4) },
  { name: "Spring Bank Holiday", date: new Date(2026, 4, 25) },
  { name: "Summer Bank Holiday", date: new Date(2026, 7, 31) },
  { name: "Christmas Day", date: new Date(2026, 11, 25) },
  { name: "Boxing Day", date: new Date(2026, 11, 28) },
  // 2027
  { name: "New Year's Day", date: new Date(2027, 0, 1) },
  { name: "Good Friday", date: new Date(2027, 3, 26) },
  { name: "Easter Monday", date: new Date(2027, 3, 29) },
  { name: "Early May Bank Holiday", date: new Date(2027, 4, 3) },
  { name: "Spring Bank Holiday", date: new Date(2027, 5, 31) },
  { name: "Summer Bank Holiday", date: new Date(2027, 7, 30) },
  { name: "Christmas Day", date: new Date(2027, 11, 25) },
  { name: "Boxing Day", date: new Date(2027, 11, 28) },
  // 2028
  { name: "New Year's Day", date: new Date(2028, 0, 1) },
  { name: "Good Friday", date: new Date(2028, 3, 14) },
  { name: "Easter Monday", date: new Date(2028, 3, 17) },
  { name: "Early May Bank Holiday", date: new Date(2028, 4, 1) },
  { name: "Spring Bank Holiday", date: new Date(2028, 5, 29) },
  { name: "Summer Bank Holiday", date: new Date(2028, 7, 28) },
  { name: "Christmas Day", date: new Date(2028, 11, 25) },
  { name: "Boxing Day", date: new Date(2028, 11, 26) },
  // 2029
  { name: "New Year's Day", date: new Date(2029, 0, 1) },
  { name: "Good Friday", date: new Date(2029, 3, 30) },
  { name: "Easter Monday", date: new Date(2029, 4, 2) },
  { name: "Early May Bank Holiday", date: new Date(2029, 4, 7) },
  { name: "Spring Bank Holiday", date: new Date(2029, 5, 27) },
  { name: "Summer Bank Holiday", date: new Date(2029, 7, 27) },
  { name: "Christmas Day", date: new Date(2029, 11, 25) },
  { name: "Boxing Day", date: new Date(2029, 11, 26) },
];

export default function ProgrammeExceptions() {
  const { data: allProgrammes, isLoading: programmesLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [holidayCountry, setHolidayCountry] = useState<"scotland" | "england">("scotland");

  const selectedProgramme = selectedId ? allProgrammes?.find((p) => p.id === selectedId) : null;

  const { data: exceptions = [] } = useQuery<CalendarException[]>({
    queryKey: ["/api/projects", selectedId, "exceptions"],
    enabled: !!selectedId,
  });

  const getHolidayStatus = (holiday: { date: Date }): "red" | "yellow" | "green" | "none" => {
    if (!selectedProgramme) return "none";
    if (!selectedProgramme.startDate || !selectedProgramme.endDate) return "red";

    const start = new Date(selectedProgramme.startDate);
    const end = new Date(selectedProgramme.endDate);
    const holidayDate = new Date(holiday.date);
    
    // Check if holiday falls within range
    const isInRange = holidayDate >= start && holidayDate <= end;
    
    if (!isInRange) return "none";

    // Check if it's listed in the programme's calendar exceptions
    const isListed = exceptions.some((exc) => {
      const excStart = new Date(exc.startDate);
      const excEnd = new Date(exc.endDate);
      return excStart.toDateString() === holidayDate.toDateString() ||
             excEnd.toDateString() === holidayDate.toDateString();
    });

    return isListed ? "green" : "yellow";
  };

  const holidays = holidayCountry === "scotland" ? SCOTLAND_HOLIDAYS : ENGLAND_HOLIDAYS;

  const hasMissingDates = selectedProgramme && (!selectedProgramme.startDate || !selectedProgramme.endDate);
  const holidayStatuses = selectedProgramme ? holidays.map(getHolidayStatus) : [];
  const redCount = holidayStatuses.filter(s => s === "red").length;
  const yellowCount = holidayStatuses.filter(s => s === "yellow").length;
  const greenCount = holidayStatuses.filter(s => s === "green").length;

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
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {redCount} missing dates
                </Badge>
              )}
              {yellowCount > 0 && (
                <Badge className="text-xs bg-yellow-500 text-black" data-testid="badge-yellow-holidays">
                  {yellowCount} not listed
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
          <div className="grid grid-cols-5 gap-1">
            {[2025, 2026, 2027, 2028, 2029].map((year) => (
              <div key={year} className="space-y-0.5">
                <p className="font-semibold text-xs text-foreground mb-1">{year}</p>
                <div className="space-y-0.5">
                  {holidays.filter((h) => h.date.getFullYear() === year).map((holiday, idx) => {
                    const status = getHolidayStatus(holiday);
                    const bgColors = {
                      red: "bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-700",
                      yellow: "bg-yellow-100 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-700",
                      green: "bg-green-100 dark:bg-green-950 border border-green-300 dark:border-green-700",
                      none: "",
                    };
                    const textColors = {
                      red: "text-red-900 dark:text-red-100",
                      yellow: "text-yellow-900 dark:text-yellow-100",
                      green: "text-green-900 dark:text-green-100",
                      none: "text-muted-foreground",
                    };
                    
                    return (
                      <div 
                        key={`${holiday.name}-${formatDateUK(holiday.date)}-${idx}`} 
                        className={`text-xs p-0.5 rounded transition-colors ${bgColors[status]}`}
                        data-testid={`row-holiday-${holiday.name}-${formatDateUK(holiday.date)}`}
                      >
                        <p className="font-medium text-foreground leading-none text-xs">{holiday.name}</p>
                        <p className={`leading-none font-medium text-xs ${textColors[status]}`}>
                          {formatDateUK(holiday.date)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
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
