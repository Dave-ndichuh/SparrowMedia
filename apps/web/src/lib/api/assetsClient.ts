export const API_BASE_URL = "http://127.0.0.1:8000";

export interface AssetRecord {
  id: string;
  title: string;
  file_type: "video" | "audio" | "image" | "graphics";
  file_url: string;
  proxy_url: string;
  thumbnail_url: string | null;
  duration: number;
  width: number;
  height: number;
  fps: number;
  transcript: string;
  semantic_description: string;
  semantic_tags: string[];
  metadata_json: Record<string, unknown>;
  status: "uploading" | "processing" | "indexed" | "failed";
  status_detail: string;
  similarity_score?: number;
  created_at: string;
}

export interface UploadProgressEvent {
  percent: number;
  stage: "uploading" | "processing" | "indexed" | "failed";
  message: string;
}

export function uploadMediaAsset(
  file: File,
  onProgress?: (evt: UploadProgressEvent) => void
): Promise<AssetRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);

    if (onProgress) {
      onProgress({
        percent: 0,
        stage: "uploading",
        message: "Starting upload...",
      });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress({
          percent,
          stage: percent < 100 ? "uploading" : "processing",
          message: percent < 100 ? `Uploading file (${percent}%)...` : "Processing proxy & Gemini AI indexing...",
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data: AssetRecord = JSON.parse(xhr.responseText);
          if (onProgress) {
            onProgress({
              percent: 100,
              stage: "indexed",
              message: "Indexed in pgvector vault!",
            });
          }
          resolve(data);
        } catch {
          reject(new Error("Failed to parse server response"));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error || `Upload failed with HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network connection error to Django backend"));
    };

    xhr.open("POST", `${API_BASE_URL}/api/assets/upload/`, true);
    xhr.send(formData);
  });
}

export async function fetchAssets(fileType: string = "all", search: string = ""): Promise<AssetRecord[]> {
  const params = new URLSearchParams();
  if (fileType && fileType !== "all") params.append("file_type", fileType);
  if (search) params.append("search", search);

  const res = await fetch(`${API_BASE_URL}/api/assets/?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load assets: ${res.statusText}`);
  }
  const data = await res.json();
  return data.assets || [];
}

export async function searchAssetsSemantic(
  query: string,
  fileType: string = "all"
): Promise<{ query: string; total_matches: number; results: AssetRecord[] }> {
  const res = await fetch(`${API_BASE_URL}/api/assets/search/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, file_type: fileType, limit: 30 }),
  });

  if (!res.ok) {
    throw new Error(`Semantic search failed: ${res.statusText}`);
  }

  return await res.json();
}
