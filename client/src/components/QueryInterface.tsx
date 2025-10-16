import { useState } from "react";
import { Search, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface QueryResult {
  question: string;
  answer: string;
  source: string;
}

interface QueryInterfaceProps {
  onQuery?: (query: string) => void;
  recentQueries?: QueryResult[];
  className?: string;
}

export function QueryInterface({
  onQuery,
  recentQueries = [],
  className,
}: QueryInterfaceProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onQuery?.(query);
      setQuery("");
    }
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about the contract..."
            className="pl-9"
            data-testid="input-query"
          />
        </div>
        <Button type="submit" data-testid="button-submit-query">
          <Send className="h-4 w-4 mr-2" />
          Ask
        </Button>
      </form>

      {recentQueries.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Recent Queries
          </h3>
          {recentQueries.map((result, index) => (
            <Card key={index} data-testid={`query-result-${index}`}>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {result.question}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-foreground">{result.answer}</p>
                  <Badge variant="secondary" className="text-xs mt-2">
                    Source: {result.source}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
