import { DEFAULT_CHAT_MODEL, ModelName, isValidModelName } from "@/config/llm";

class ModelStorage {
  private keyName: string;
  private static instance: ModelStorage;

  private constructor(keyName?: string) {
    this.keyName = keyName || "enso:model:chat";
  }

  public static getInstance(keyName?: string): ModelStorage {
    if (!ModelStorage.instance) {
      ModelStorage.instance = new ModelStorage(keyName);
    }
    return ModelStorage.instance;
  }

  get() {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(this.keyName) ?? null;
    } catch {
      // no-op
    }

    return null;
  }

  set(model: ModelName) {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(this.keyName, model);
    } catch {
      // no-op
    }
  }

  reset() {
    this.set(DEFAULT_CHAT_MODEL);
  }
}

// Create and export a singleton instance with default key
export const modelStorageClient = ModelStorage.getInstance();

// Helper functions that use the singleton
export function storageGetModel(): ModelName | null {
  const model = modelStorageClient.get();
  return isValidModelName(model) ? model as ModelName : null;
}

export function storageSetModel(model: ModelName): void {
  modelStorageClient.set(model);
}

export function storageResetModel(): void {
  modelStorageClient.reset();
}

// Still export the class for cases where a custom instance is needed
export default ModelStorage;