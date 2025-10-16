import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadZone } from "@/components/UploadZone";
import { FilePreviewCard } from "@/components/FilePreviewCard";
import { ExtractedDataSection } from "@/components/ExtractedDataSection";
import { QueryInterface } from "@/components/QueryInterface";
import { ExportButtons } from "@/components/ExportButtons";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, DoorOpen, AlertTriangle, FileText } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasExtractedData, setHasExtractedData] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      setHasExtractedData(true);
    }, 2000);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setHasExtractedData(false);
    setIsProcessing(false);
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Mock extracted data
  const keyDates = [
    { label: "Contract Start Date", value: "January 15, 2025", confidence: 98 },
    { label: "Completion Date", value: "December 31, 2025", confidence: 95 },
    { label: "Payment Due Date", value: "30 days from invoice", confidence: 92 },
    { label: "Milestone Review", value: "Quarterly (March, June, September, December)", confidence: 89 },
  ];

  const accessDetails = [
    { label: "Site Access Hours", value: "Monday-Friday, 7:00 AM - 6:00 PM", confidence: 96 },
    { label: "Access Restrictions", value: "Permit required for heavy machinery", confidence: 88 },
    { label: "Key Holder", value: "John Smith, Site Manager", confidence: 94 },
    { label: "Emergency Contact", value: "+1 (555) 123-4567", confidence: 91 },
  ];

  const damages = [
    { label: "Liquidated Damages", value: "$5,000 per day delay", confidence: 97 },
    { label: "Late Payment Fee", value: "2% per month", confidence: 93 },
    { label: "Performance Bond", value: "10% of contract value", confidence: 91 },
    { label: "Warranty Period", value: "12 months from completion", confidence: 87 },
  ];

  const mockQueries = [
    {
      question: "What is the penalty for late completion?",
      answer: "$5,000 per day for each day of delay after the completion date.",
      source: "Section 8.3, Page 12",
    },
    {
      question: "When does the contract start?",
      answer: "The contract commencement date is January 15, 2025.",
      source: "Section 2.1, Page 3",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-12 lg:px-16">
        {!file ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Contract Analyzer
              </h1>
              <p className="text-muted-foreground">
                Extract key data from construction contracts using AI
              </p>
            </div>
            <UploadZone onFileSelect={handleFileSelect} />
            <div className="mt-12">
              <EmptyState
                title="No contracts uploaded yet"
                description="Upload a construction contract PDF to begin extracting key information and analyzing contract terms."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Contract Analysis
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-powered extraction and analysis
                </p>
              </div>
              {hasExtractedData && <ExportButtons onExport={(format) => console.log("Export:", format)} />}
            </div>

            <FilePreviewCard
              fileName={file.name}
              fileSize={formatFileSize(file.size)}
              status={isProcessing ? "processing" : "complete"}
              onRemove={handleRemoveFile}
            />

            {isProcessing ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="text-sm text-muted-foreground">
                    Analyzing contract...
                  </p>
                </div>
              </div>
            ) : hasExtractedData ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="overview" data-testid="tab-overview">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="query" data-testid="tab-query">
                    Ask Questions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <ExtractedDataSection
                      title="Key Dates"
                      icon={<Calendar className="h-5 w-5 text-primary" />}
                      data={keyDates}
                    />
                    <ExtractedDataSection
                      title="Access Details"
                      icon={<DoorOpen className="h-5 w-5 text-primary" />}
                      data={accessDetails}
                    />
                    <ExtractedDataSection
                      title="Damages & Penalties"
                      icon={<AlertTriangle className="h-5 w-5 text-chart-3" />}
                      data={damages}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="query" className="mt-6">
                  <QueryInterface
                    onQuery={(query) => console.log("Query:", query)}
                    recentQueries={mockQueries}
                  />
                </TabsContent>
              </Tabs>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
