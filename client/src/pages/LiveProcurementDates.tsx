import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LiveProcurementDates() {
  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-live-procurement-title">Live Procurement Dates</h1>
        <p className="text-muted-foreground mt-2">Real-time procurement scheduling and status tracking</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Procurement Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Live procurement data will be displayed here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
