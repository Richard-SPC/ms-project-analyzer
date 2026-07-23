import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { format } from "date-fns";
import { Lock, Unlock, Plus, Trash2, RotateCcw, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateUK } from "@/lib/utils";
import type { PublicHoliday } from "@shared/schema";

type Country = "scotland" | "england";

interface HolidaySettings {
  scotland: boolean;
  england: boolean;
}

export default function HolidaySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCountry, setActiveCountry] = useState<Country>("scotland");
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");

  const isAdmin = user?.role === "admin";

  const { data: holidays = [], isLoading: holidaysLoading } = useQuery<PublicHoliday[]>({
    queryKey: ["/api/public-holidays", activeCountry],
    queryFn: () => fetch(`/api/public-holidays?country=${activeCountry}`).then(r => r.json()),
  });

  const { data: lockSettings, isLoading: settingsLoading } = useQuery<HolidaySettings>({
    queryKey: ["/api/holiday-settings"],
  });

  const isLocked = lockSettings ? lockSettings[activeCountry] : false;
  const isEmpty = !holidaysLoading && holidays.length === 0;

  const addMutation = useMutation({
    mutationFn: (data: { name: string; date: string; country: string }) =>
      apiRequest("POST", "/api/public-holidays", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-holidays"] });
      setNewName("");
      setNewDate("");
      toast({ title: "Holiday added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/public-holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-holidays"] });
      toast({ title: "Holiday removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const lockMutation = useMutation({
    mutationFn: (data: { country: string; locked: boolean }) =>
      apiRequest("POST", "/api/holiday-settings/lock", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holiday-settings"] });
      toast({ title: isLocked ? "List unlocked" : "List locked" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: (country: string) =>
      apiRequest("POST", "/api/public-holidays/seed", { country }),
    onSuccess: (_, country) => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-holidays"] });
      toast({ title: `${country === "scotland" ? "Scotland" : "England"} holidays reset to defaults` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleAdd = () => {
    if (!newName.trim() || !newDate) return;
    addMutation.mutate({ name: newName.trim(), date: newDate, country: activeCountry });
  };

  // Group holidays by year
  const byYear = holidays.reduce((acc, h) => {
    const year = new Date(h.date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(h);
    return acc;
  }, {} as Record<number, PublicHoliday[]>);

  const years = Object.keys(byYear).map(Number).sort();

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-holiday-settings-title">
          Holiday Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the public holiday list used to check programme calendar compliance. Admins can lock a list to prevent changes.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={activeCountry === "scotland" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCountry("scotland")}
          data-testid="button-tab-scotland"
        >
          Scotland
        </Button>
        <Button
          variant={activeCountry === "england" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCountry("england")}
          data-testid="button-tab-england"
        >
          England
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                {activeCountry === "scotland" ? "Scotland" : "England"} Public Holidays
              </CardTitle>
              {!settingsLoading && (
                <Badge variant={isLocked ? "destructive" : "secondary"} data-testid="badge-lock-status">
                  {isLocked ? "Locked" : "Unlocked"}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs" data-testid="badge-holiday-count">
                {holidays.length} holidays
              </Badge>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lockMutation.mutate({ country: activeCountry, locked: !isLocked })}
                  disabled={lockMutation.isPending || settingsLoading}
                  data-testid="button-toggle-lock"
                >
                  {isLocked ? <Unlock className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                  {isLocked ? "Unlock" : "Lock"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Reset ${activeCountry} holidays to defaults? This will replace the current list.`)) {
                      seedMutation.mutate(activeCountry);
                    }
                  }}
                  disabled={seedMutation.isPending || isLocked}
                  data-testid="button-reset-defaults"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset to Defaults
                </Button>
              </div>
            )}
          </div>
          {isLocked && (
            <CardDescription className="text-amber-600 dark:text-amber-400 text-xs mt-1">
              This list is locked. Only admins can unlock it to make changes.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && !isLocked && (
            <div className="flex items-end gap-2 p-3 bg-muted/50 rounded-md">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block">Holiday Name</label>
                <Input
                  placeholder="e.g. Christmas Day"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  data-testid="input-new-holiday-name"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium mb-1 block">Date</label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  data-testid="input-new-holiday-date"
                />
              </div>
              <Button
                onClick={handleAdd}
                disabled={!newName.trim() || !newDate || addMutation.isPending}
                data-testid="button-add-holiday"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          )}

          {holidaysLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No holidays added yet.</p>
              {isAdmin && !isLocked && (
                <p className="text-xs mt-1">Add holidays above or use "Reset to Defaults" to load the standard list.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {years.map((year) => (
                <div key={year}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{year}</p>
                  <div className="border rounded-md overflow-hidden">
                    {byYear[year].map((holiday, idx) => (
                      <div
                        key={holiday.id}
                        className={`flex items-center justify-between px-3 py-2 text-sm ${idx % 2 === 0 ? "" : "bg-muted/30"}`}
                        data-testid={`row-holiday-${holiday.id}`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="w-28 text-xs text-muted-foreground shrink-0">
                            {formatDateUK(new Date(holiday.date))}
                          </span>
                          <span className="font-medium truncate">{holiday.name}</span>
                        </div>
                        {isAdmin && !isLocked && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(holiday.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-holiday-${holiday.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          You are viewing the holiday list in read-only mode. Contact an admin to make changes.
        </p>
      )}
    </div>
  );
}
