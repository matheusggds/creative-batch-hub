

## Correção do Payload do Quick Flow

### Problema
O payload atual (linhas 138-149) envia `pipelineType: "multimodal_image_generation"`, `shotId: "medium_front"`, e `promptPackId`, que fazem o backend tentar resolver um shot inexistente → `shot_not_found`.

### Payload anterior (quebrado)
```typescript
{
  toolType: "quick_similar_image",
  pipelineType: "multimodal_image_generation",  // ← errado
  sourceMode: "single_asset",
  avatarProfileId: null,
  referenceAssetIds: [assetId],
  supportingAssetIds: [],                        // ← desnecessário
  input: {
    promptPackId: "ugc-avatar-reference-pack-v1", // ← causa shot lookup
    shotId: "medium_front",                        // ← causa shot_not_found
    geminiPreferredModel: "gemini-3-pro-image-preview", // ← desnecessário
  },
}
```

### Payload final (corrigido)
```typescript
{
  toolType: "quick_similar_image",
  pipelineType: "text_to_image",
  sourceMode: "single_asset",
  referenceAssetIds: [assetId],
}
```

Sem `avatarProfileId`, sem `supportingAssetIds`, sem `input`, sem `shotId`, sem `promptPackId`, sem `focusPiece`.

### Mudança
Arquivo único: `src/pages/QuickFlow.tsx`, linhas 135-152. Substituir o body do `supabase.functions.invoke` pelo payload mínimo seguro. Tudo mais (UI, estados, polling, modais) permanece intacto.

### O que é eliminado
- Erro `shot_not_found` — sim, eliminado pela remoção de `shotId` e `promptPackId`
- Dependência residual de fluxo multimodal — sim, `pipelineType` corrigido para `text_to_image`

### O que depende do backend/Codex
- Validação de que `toolType: "quick_similar_image"` + `pipelineType: "text_to_image"` é aceito pelo `create-generation`
- Se o `run-job` sabe lidar com esse tuple sem shot/promptPack

