import OpenAI from "openai";
import type { EmbeddingProvider } from "./types";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai-text-embedding-3-small";

  constructor(private readonly client: OpenAI) {}

  async embed(texts: string[]) {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
      encoding_format: "float",
    });
    return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}
