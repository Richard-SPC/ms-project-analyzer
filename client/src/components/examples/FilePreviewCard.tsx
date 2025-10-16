import { FilePreviewCard } from "../FilePreviewCard";

export default function FilePreviewCardExample() {
  return (
    <div className="p-6 space-y-4">
      <FilePreviewCard
        fileName="construction-contract-2024.pdf"
        fileSize="2.4 MB"
        status="complete"
        onRemove={() => console.log("Remove file")}
      />
      <FilePreviewCard
        fileName="building-agreement.pdf"
        fileSize="1.8 MB"
        status="processing"
      />
    </div>
  );
}
