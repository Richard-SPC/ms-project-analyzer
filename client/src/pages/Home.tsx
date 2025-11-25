import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadZone } from "@/components/UploadZone";
import { FilePreviewCard } from "@/components/FilePreviewCard";
import { ExtractedDataSection } from "@/components/ExtractedDataSection";
import { AccessDatesTable } from "@/components/AccessDatesTable";
import { CompletionDatesTable } from "@/components/CompletionDatesTable";
import { DamagesTable } from "@/components/DamagesTable";
import { QueryInterface } from "@/components/QueryInterface";
import { ExportButtons } from "@/components/ExportButtons";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { Calendar, DoorOpen } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Contract, Query, ExtractedData } from "@shared/schema";

export default function Home() {
  const [currentContractId, setCurrentContractId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch current contract data
  const { data: currentContract, isLoading: isLoadingContract, error: contractError } = useQuery<Contract>({
    queryKey: ["/api/contracts", currentContractId],
    queryFn: async () => {
      if (!currentContractId) throw new Error("No contract ID");
      const res = await fetch(`/api/contracts/${currentContractId}`);
      if (!res.ok) throw new Error("Failed to fetch contract");
      return res.json();
    },
    enabled: !!currentContractId,
    retry: 1,
  });

  // Handle contract fetch errors
  useEffect(() => {
    if (contractError && currentContractId) {
      toast({
        title: "Error",
        description: "Failed to load contract data. Please try uploading again.",
        variant: "destructive",
      });
      setCurrentContractId(null);
    }
  }, [contractError, currentContractId, toast]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/contracts/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json() as Promise<Contract>;
    },
    onSuccess: (contract) => {
      setCurrentContractId(contract.id);
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      // Invalidate and refetch the contract to ensure we have latest data
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contract.id] });
      toast({
        title: "Success",
        description: "Contract analyzed successfully",
      });
    },
    onError: (error) => {
      // Reset state on error
      setCurrentContractId(null);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload contract",
        variant: "destructive",
      });
    },
  });

  const { data: queries = [] } = useQuery<Query[]>({
    queryKey: ["/api/contracts", currentContractId, "queries"],
    queryFn: async () => {
      if (!currentContractId) throw new Error("No contract ID");
      const res = await fetch(`/api/contracts/${currentContractId}/queries`);
      if (!res.ok) throw new Error("Failed to fetch queries");
      return res.json();
    },
    enabled: !!currentContractId,
  });

  const queryMutation = useMutation({
    mutationFn: async (question: string) => {
      if (!currentContractId) throw new Error("No contract selected");
      
      const res = await apiRequest("POST", `/api/contracts/${currentContractId}/query`, { question });
      return res.json() as Promise<Query>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/contracts", currentContractId, "queries"] 
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process query",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    uploadMutation.mutate(file);
  };

  const handleRemoveFile = () => {
    setCurrentContractId(null);
  };

  const handleQuery = (question: string) => {
    queryMutation.mutate(question);
  };

  const handleExport = (format: "json" | "csv") => {
    if (!currentContract?.extractedData) return;

    const data = currentContract.extractedData as ExtractedData;

    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentContract.fileName.replace(".pdf", "")}-extracted.json`;
      a.click();
    } else {
      let csv = "Category,Label,Value,Confidence\n";
      
      for (const [category, items] of Object.entries(data)) {
        for (const item of items as Array<{ label: string; value: string | null; confidence: number }>) {
          csv += `"${category}","${item.label}","${item.value || ""}",${item.confidence}\n`;
        }
      }

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentContract.fileName.replace(".pdf", "")}-extracted.csv`;
      a.click();
    }

    toast({
      title: "Success",
      description: `Data exported as ${format.toUpperCase()}`,
    });
  };

  const extractedData = currentContract?.extractedData as ExtractedData | undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-12 lg:px-16">
        {!currentContractId ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Contract Analyser
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
              {extractedData && <ExportButtons onExport={handleExport} />}
            </div>

            {currentContract && (
              <FilePreviewCard
                fileName={currentContract.fileName}
                fileSize={currentContract.fileSize}
                status="complete"
                onRemove={handleRemoveFile}
              />
            )}

            {(uploadMutation.isPending || isLoadingContract) ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="text-sm text-muted-foreground">
                    Analyzing contract...
                  </p>
                </div>
              </div>
            ) : extractedData ? (
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
                  {extractedData?.accessDates && extractedData.accessDates.length > 0 && (
                    <AccessDatesTable data={extractedData.accessDates} />
                  )}
                  
                  {extractedData?.completionDates && extractedData.completionDates.length > 0 && (
                    <CompletionDatesTable data={extractedData.completionDates} />
                  )}
                  
                  {extractedData?.damages && extractedData.damages.length > 0 && (
                    <DamagesTable data={extractedData.damages} />
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ExtractedDataSection
                      title="Key Dates"
                      icon={<Calendar className="h-5 w-5 text-primary" />}
                      data={extractedData?.keyDates || []}
                    />
                    <ExtractedDataSection
                      title="Access Details"
                      icon={<DoorOpen className="h-5 w-5 text-primary" />}
                      data={extractedData?.accessDetails || []}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="query" className="mt-6">
                  <QueryInterface
                    onQuery={handleQuery}
                    recentQueries={queries.map(q => ({
                      question: q.question,
                      answer: q.answer,
                      source: q.source || "Unknown",
                    }))}
                  />
                  {queryMutation.isPending && (
                    <div className="mt-4 text-center">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Processing your question...
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
