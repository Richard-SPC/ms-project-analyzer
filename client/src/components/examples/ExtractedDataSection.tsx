import { ExtractedDataSection } from "../ExtractedDataSection";
import { Calendar, DoorOpen, AlertTriangle } from "lucide-react";

export default function ExtractedDataSectionExample() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <ExtractedDataSection
          title="Key Dates"
          icon={<Calendar className="h-5 w-5 text-primary" />}
          data={[
            { label: "Contract Start Date", value: "January 15, 2025", confidence: 98 },
            { label: "Completion Date", value: "December 31, 2025", confidence: 95 },
            { label: "Payment Due Date", value: "30 days from invoice", confidence: 92 },
          ]}
        />
        <ExtractedDataSection
          title="Access Details"
          icon={<DoorOpen className="h-5 w-5 text-primary" />}
          data={[
            { label: "Site Access Hours", value: "Monday-Friday, 7:00 AM - 6:00 PM", confidence: 96 },
            { label: "Access Restrictions", value: "Permit required for heavy machinery", confidence: 88 },
            { label: "Key Holder", value: "John Smith, Site Manager", confidence: 94 },
          ]}
        />
        <ExtractedDataSection
          title="Damages & Penalties"
          icon={<AlertTriangle className="h-5 w-5 text-chart-3" />}
          data={[
            { label: "Liquidated Damages", value: "$5,000 per day delay", confidence: 97 },
            { label: "Late Payment Fee", value: "2% per month", confidence: 93 },
            { label: "Performance Bond", value: "10% of contract value", confidence: 91 },
          ]}
        />
      </div>
      <ExtractedDataSection
        title="No Data Example"
        data={[
          { label: "Field 1", value: null },
          { label: "Field 2", value: null },
        ]}
      />
    </div>
  );
}
