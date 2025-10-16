import { QueryInterface } from "../QueryInterface";

export default function QueryInterfaceExample() {
  const mockResults = [
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
    <div className="p-6">
      <QueryInterface
        onQuery={(query) => console.log("Query submitted:", query)}
        recentQueries={mockResults}
      />
    </div>
  );
}
