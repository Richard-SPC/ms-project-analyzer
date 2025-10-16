import { ExportButtons } from "../ExportButtons";

export default function ExportButtonsExample() {
  return (
    <div className="p-6">
      <ExportButtons
        onExport={(format) => console.log("Exporting as:", format)}
      />
    </div>
  );
}
