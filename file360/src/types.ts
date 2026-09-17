export type FileCategory = "image" | "pdf" | "media" | "archive" | "unknown";

export type Artifact = {
  id: string;
  name: string;
  blob: Blob;
  detail?: string;
  cleanup?: () => Promise<void> | void;
};

export type ProgressUpdate = {
  value: number | null;
  label: string;
};

export type JobState = "idle" | "preparing" | "processing" | "done" | "failed" | "cancelled";

export type ToolError = {
  code: string;
  message: string;
  detail?: string;
};
