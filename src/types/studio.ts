export interface AiParameters {
  style_prompt?: string;
  negative_prompt?: string;
  aspect_ratio: "9:16" | "1:1" | "16:9" | "4:5";
}

export interface Asset {
  id: string;
  user_id: string;
  type: "avatar" | "clothing" | "product";
  file_url: string;
  name: string | null;
  created_at: string;
}

export interface GenerationBatch {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "completed";
  created_at: string;
}

export interface Generation {
  id: string;
  batch_id: string;
  user_id: string;
  base_asset_id: string;
  reference_asset_id: string;
  result_url: string | null;
  ai_parameters: AiParameters;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}
