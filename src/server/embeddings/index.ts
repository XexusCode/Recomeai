import { env } from "@/env";
import { tokenHashIndex, tokenize } from "@/lib/text";

type EmbeddingProvider = "generic" | "openai";

export interface Embeddings {
  dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

interface RemoteEmbeddingsOptions {
  provider: EmbeddingProvider;
  model?: string;
}

function limitConcurrency(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        running += 1;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          running -= 1;
          if (queue.length > 0) {
            const next = queue.shift();
            if (next) next();
          }
        }
      };

      if (running < concurrency) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}

function l2Normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0));
  if (magnitude === 0) {
    return vector.slice();
  }
  return vector.map((value) => value / magnitude);
}

export class LocalTfIdfEmbeddings implements Embeddings {
  public readonly dim: number;

  constructor(dim = 768) {
    this.dim = dim;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) {
      return [];
    }
    const tokenized = texts.map((text) => tokenize(text));
    const df = new Map<string, number>();
    tokenized.forEach((tokens) => {
      const unique = new Set(tokens);
      unique.forEach((token) => {
        df.set(token, (df.get(token) ?? 0) + 1);
      });
    });
    const totalDocs = texts.length;
    return tokenized.map((tokens) => {
      if (!tokens.length) {
        return new Array(this.dim).fill(0);
      }
      const tf = new Map<string, number>();
      tokens.forEach((token) => {
        tf.set(token, (tf.get(token) ?? 0) + 1);
      });
      const vector = new Array(this.dim).fill(0);
      for (const [token, count] of tf.entries()) {
        const tfValue = count / tokens.length;
        const idf = Math.log((1 + totalDocs) / (1 + (df.get(token) ?? 0))) + 1;
        const bucket = tokenHashIndex(token, this.dim);
        vector[bucket] += tfValue * idf;
      }
      return l2Normalize(vector);
    });
  }
}

export class RemoteEmbeddings implements Embeddings {
  public readonly dim: number;
  private readonly base: string;
  private readonly apiKey?: string;
  private readonly provider: EmbeddingProvider;
  private readonly model?: string;

  constructor(base: string, dim: number, apiKey: string | undefined, options: RemoteEmbeddingsOptions) {
    this.base = base.replace(/\/$/, "");
    this.dim = dim;
    this.apiKey = apiKey;
    this.provider = options.provider;
    this.model = options.model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) {
      return [];
    }
    const limit = limitConcurrency(4);
    const batched: string[][] = [];
    const chunkSize = 16;
    for (let i = 0; i < texts.length; i += chunkSize) {
      batched.push(texts.slice(i, i + chunkSize));
    }
    const results = await Promise.all(
      batched.map((batch) =>
        limit(async () => {
          if (this.provider === "openai") {
            return this.fetchOpenAI(batch);
          }
          return this.fetchGeneric(batch);
        }),
      ),
    );
    return results.flat();
  }

  private async fetchGeneric(batch: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.EMBEDDINGS_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.base}/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ texts: batch, dim: this.dim }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Remote embeddings failed with status ${response.status}`);
      }
      const payload = (await response.json()) as { data?: number[][] };
      if (!payload?.data || payload.data.length !== batch.length) {
        throw new Error("Unexpected embeddings response shape");
      }
      return payload.data.map((vector) => {
        if (vector.length !== this.dim) {
          throw new Error("Remote embeddings dimension mismatch");
        }
        return l2Normalize(vector);
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchOpenAI(batch: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error("OpenAI embeddings require EMBEDDINGS_API_KEY");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.EMBEDDINGS_TIMEOUT_MS);
    try {
      const endpoint = `${this.base}/embeddings`;
      const body: Record<string, unknown> = {
        model: this.model ?? "text-embedding-3-small",
        input: batch,
      };
      if (this.dim) {
        body.dimensions = this.dim;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Remote embeddings failed with status ${response.status}`);
      }
      const payload = (await response.json()) as OpenAIEmbeddingsResponse;
      if (!payload?.data || payload.data.length !== batch.length) {
        throw new Error("Unexpected embeddings response shape");
      }
      return payload.data.map((item) => {
        if (!item.embedding || item.embedding.length !== this.dim) {
          throw new Error("Remote embeddings dimension mismatch");
        }
        return l2Normalize(item.embedding);
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

let cachedEmbeddings: Embeddings | null = null;

export function getEmbeddings(): Embeddings {
  if (cachedEmbeddings) {
    return cachedEmbeddings;
  }
  if (env.EMBEDDINGS_API_BASE) {
    const provider = env.EMBEDDINGS_PROVIDER ?? "generic";
    const targetDim = env.EMBEDDINGS_DIM ?? 768;
    cachedEmbeddings = new RemoteEmbeddings(
      env.EMBEDDINGS_API_BASE,
      targetDim,
      env.EMBEDDINGS_API_KEY,
      { provider, model: env.EMBEDDINGS_MODEL },
    );
  } else {
    cachedEmbeddings = new LocalTfIdfEmbeddings(env.EMBEDDINGS_DIM ?? 768);
  }
  return cachedEmbeddings;
}

interface OpenAIEmbeddingsResponse {
  data: Array<{
    embedding: number[];
  }>;
}

