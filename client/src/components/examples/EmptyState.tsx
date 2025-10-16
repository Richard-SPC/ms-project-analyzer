import { EmptyState } from "../EmptyState";

export default function EmptyStateExample() {
  return (
    <div className="p-6">
      <EmptyState
        title="No contracts uploaded yet"
        description="Upload a construction contract PDF to begin extracting key information and analyzing contract terms."
      />
    </div>
  );
}
