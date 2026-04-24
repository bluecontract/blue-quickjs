declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker(_: unknown, label: string): Worker;
    };
  }
}

export {};
