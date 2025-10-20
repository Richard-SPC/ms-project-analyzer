import {
  type Contract,
  type InsertContract,
  type Query,
  type InsertQuery,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createContract(contract: InsertContract): Promise<Contract>;
  getContract(id: string): Promise<Contract | undefined>;
  getAllContracts(): Promise<Contract[]>;
  deleteContract(id: string): Promise<void>;
  
  createQuery(query: InsertQuery): Promise<Query>;
  getQueriesByContract(contractId: string): Promise<Query[]>;
}

export class MemStorage implements IStorage {
  private contracts: Map<string, Contract>;
  private queries: Map<string, Query>;

  constructor() {
    this.contracts = new Map();
    this.queries = new Map();
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const id = randomUUID();
    const contract: Contract = {
      ...insertContract,
      id,
      uploadedAt: new Date(),
      extractedData: insertContract.extractedData ?? null,
      fullText: insertContract.fullText ?? null,
    };
    this.contracts.set(id, contract);
    return contract;
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async getAllContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values()).sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }

  async deleteContract(id: string): Promise<void> {
    this.contracts.delete(id);
    // Also delete related queries
    const queryEntries = Array.from(this.queries.entries());
    for (const [queryId, query] of queryEntries) {
      if (query.contractId === id) {
        this.queries.delete(queryId);
      }
    }
  }

  async createQuery(insertQuery: InsertQuery): Promise<Query> {
    const id = randomUUID();
    const query: Query = {
      ...insertQuery,
      id,
      createdAt: new Date(),
      source: insertQuery.source ?? null,
    };
    this.queries.set(id, query);
    return query;
  }

  async getQueriesByContract(contractId: string): Promise<Query[]> {
    return Array.from(this.queries.values())
      .filter((query) => query.contractId === contractId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const storage = new MemStorage();
