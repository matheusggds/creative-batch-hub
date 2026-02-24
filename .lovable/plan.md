

# Refatoração da UI: Image -> Prompt -> Image

## Resumo das Mudanças

O fluxo muda de "Avatar + Roupa" para "Apenas 1 imagem de referência". A OpenAI extrai o prompt, o Gemini gera do zero. A UI precisa refletir isso com um grid de resultados clicáveis e um modal de observabilidade.

---

## Tarefa 1: Coluna Esquerda — Remover Avatar Base

### `src/pages/Studio.tsx`
- Remover o estado `selectedAvatar` e o Card "Avatar Base" inteiro
- Manter apenas o Card de "Imagem de Referência" (renomear o antigo "Referência de Roupa")
- Ajustar `canGenerate` para depender apenas de `selectedClothing.length > 0` (renomear variável para `selectedReferences`)
- No `handleGenerate`, passar `baseAssetId: null` (ou omitir) e enviar `referenceAssetIds`
- Manter o Select de Modelos OpenAI no AiSettings

### `src/hooks/useBatches.ts`
- Tornar `baseAssetId` opcional (aceitar `null | undefined`)
- Ao inserir `generations`, enviar `base_asset_id: baseAssetId || null`

### `src/types/studio.ts`
- Ajustar o tipo `Generation.base_asset_id` para `string | null`

---

## Tarefa 2: Grid de Resultados (Coluna Direita)

### `src/components/studio/BatchResults.tsx` — Reescrever
- Remover a estrutura de cards por batch; exibir um grid flat de todas as generations
- Cada card no grid:
  - `processing` → Skeleton animado com badge de status intermediário
  - `completed` → Thumbnail da `result_url`
  - `failed` → Card vermelho com ícone `AlertTriangle`
- Todos os cards clicáveis (`onClick` abre modal)
- Manter agrupamento visual leve (mostrar data relativa no card)

---

## Tarefa 3: Modal de Observabilidade

### Novo arquivo: `src/components/studio/GenerationDetailModal.tsx`
- Usar `Dialog` do shadcn/ui
- Props: `generation: Generation | null`, `open: boolean`, `onOpenChange`
- Layout do modal:
  - **Header**: Badge com status da geração (pending/processing/completed/failed)
  - **Corpo - Visual**: Duas imagens lado a lado — Imagem de Referência (buscar via `reference_asset_id` nos assets) e Imagem Gerada (`result_url`)
  - **Corpo - Metadados**: Badges com `ai_parameters.openai_model` e `ai_parameters.gemini_model_used`
  - **Corpo - Erro**: Se `status === 'failed'`, Alert vermelho com `ai_parameters.error_message`
  - **Corpo - Prompt Extraído**: ScrollArea ou Textarea readonly com `ai_parameters.extracted_prompt`. Visível mesmo durante processing (reatividade via Realtime)
- O componente lê dados de `ai_parameters` como JSONB castado

### `src/components/studio/BatchResults.tsx`
- Adicionar estado `selectedGeneration` para controlar o modal
- Renderizar `GenerationDetailModal` com a generation selecionada

### Reatividade
- O hook `useGenerationsRealtime` já existe e invalida queries. Quando `ai_parameters` for atualizado pelo backend (ex: `extracted_prompt` populado), o React Query refaz o fetch e o modal atualiza automaticamente.

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/pages/Studio.tsx` | Remover avatar, renomear referência |
| `src/hooks/useBatches.ts` | `baseAssetId` opcional |
| `src/types/studio.ts` | `base_asset_id` nullable |
| `src/components/studio/BatchResults.tsx` | Reescrever como grid + modal state |
| `src/components/studio/GenerationDetailModal.tsx` | **Novo** — modal de detalhes |
| `src/components/studio/AssetGallery.tsx` | Ajustar texto vazio ("Nenhum item") |

