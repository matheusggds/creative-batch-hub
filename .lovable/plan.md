

# Fixes Consolidados — Quick Flow + Avatar Workspace

## Resumo das alterações

11 fixes pontuais distribuídos em 5 arquivos. Sem mudança de arquitetura.

## Detalhes por fix

### 1. Typos — "imagem{ns}" → "imagens"
- `AvatarDetails.tsx` linha 298: `imagem{refCount !== 1 ? "ns" : ""}` → `imagem{refCount !== 1 ? "ns" : ""}` — na verdade o plural "ns" gera "imagemns". Corrigir para: `{refCount === 1 ? "imagem" : "imagens"}`
- `NewGenerationModal.tsx` linha 486: mesmo padrão, corrigir
- `QuickFlow.tsx` linha 725: `variação{pendingCount > 1 ? "ões" : ""}` gera "variaçãoões". Corrigir para `{pendingCount === 1 ? "variação" : "variações"}`

### 2. Contagem de imagens no header do avatar
- `AvatarDetails.tsx` linha ~269/298: `refCount` usa `avatar.references.length` que inclui tudo. Mudar para contar apenas referências com `file_url` existente, ou melhor, contar completed generations + originals. Criar um `completedImageCount` baseado em `gridItems` filtrando apenas items com imagem visível (references com file_url + completed generations com result_url).

### 3. Delete em TODOS os cards da biblioteca
- `GenerationCard` (linha 633-722) não tem botão de delete nem recebe `onDelete` prop. Adicionar:
  - Prop `onDelete` ao `GenerationCard`
  - Botão de lixeira no hover para cards completed, failed e qualquer outro status
  - No `AvatarDetails`, passar `onDelete` ao `GenerationCard` chamando `setDeleteImageTarget` com o generation's `result_asset_id` (para completed) ou o generation `id` (para failed)
  - Para failed generations sem asset, chamar delete-asset com o generation id ou simplesmente permitir exclusão via edge function

### 4. Mensagens técnicas humanizadas
- **Inspector (ImageDetailModal.tsx)**:
  - Linha 313: `generation!.current_step` mostrado cru → usar `humanizeStep()` (já existe em AvatarDetails, extrair para utils ou duplicar)
  - Linha 324-326: `generation.error_code` mostrado cru no painel de falha → mapear para mensagem amigável
  - Linha 127-145: `getSourceModeLabel` e `getPipelineLabel` — adicionar mapeamentos para `avatar_workspace` → "Avatar Workspace", `quick_flow` → "Quick Flow", `multimodal_image_generation` → "Geração de imagem"
  - Manter valores técnicos crus APENAS na seção "Detalhes técnicos" colapsada (já está assim para a maioria)
- **Criar mapeamento de error codes amigáveis** compartilhado:
  - `gemini_multimodal_generation_failed` → "A geração falhou. Tente novamente."
  - `gemini_generation_failed` → "A geração falhou. Tente novamente."
  - `provider_timeout_50s` / `provider_timeout_60s` → "A geração demorou demais. Tente novamente."
  - Fallback → "Ocorreu um erro. Tente novamente."

### 5. Placeholders travados → erro após 90s
- `GenerationCard` em AvatarDetails: adicionar lógica de timeout local
  - Usar `useEffect` + `useState` dentro do `GenerationCard`: se `isActive` por mais de 90s, mostrar estado de erro com ícone ⚠️ + texto "A geração parece travada" + botão "Excluir"
  - Se o status muda para `failed` no backend antes dos 90s, o componente já re-renderiza normalmente

### 6. Botão "Carregar mais" no histórico (Quick Flow)
- Já implementado! `QuickFlowHistory.tsx` já usa botão manual "Carregar mais" com `fetchNextPage`. Verificar se não há infinite scroll automático em outro lugar — confirmar que está OK.

### 7. Contagem no histórico só completed
- `useQuickFlowHistory.ts` linha ~107: `variationCount: variations.length` já filtra `g.status === "completed"` (linha ~100-105). Já está correto.

### 8. Seletor de quantidade resetar ao restaurar sessão
- `QuickFlow.tsx` `applyRestore` (linha 502): já faz `setSelectedCount(1)`. Já está correto.

### 9. Scroll horizontal nas thumbnails
- `VariationThumbnailStrip` (linha 1052-1141) já usa `flex-nowrap overflow-x-auto` com fade indicators. Já está implementado.

### 10. Botão "Gerar Variações" desabilitado durante loading
- Linha 788: `disabled={pendingCount > 0 || generateMutation.isPending || !activeVar}` — já inclui `pendingCount > 0`. Mas falta incluir `step === "tracking"` e `step === "generating"`. Adicionar `hasGenerationInProgress` (já existe na linha 558) ao disabled.

### 11. Toast de conclusão vs renderização
- Remover toasts de "Imagem pronta!" que disparam antes da imagem renderizar. O card mudando de placeholder para imagem já é feedback suficiente. Remover o `toast.success` no `handleVariationComplete` se existir, e no efeito de tracking completion.

## Arquivos alterados

1. **`src/lib/generation-utils.ts`** — adicionar `humanizeStep()`, `friendlyErrorCode()`, mapas de pipeline/source mode
2. **`src/pages/AvatarDetails.tsx`** — fix typo plural, contagem correta, delete em GenerationCard, stall timeout em GenerationCard, usar humanize utils
3. **`src/components/avatar/NewGenerationModal.tsx`** — fix typo plural
4. **`src/pages/QuickFlow.tsx`** — fix typo plural, desabilitar botão com hasGenerationInProgress, remover toast prematuro
5. **`src/components/avatar/ImageDetailModal.tsx`** — humanizar step/error/pipeline/source_mode no painel principal

## O que NÃO muda

Wizard de Nova Geração, seletor de modelo, inspector navigation, badges, pipeline, Edge Functions, Quick Flow batch/lightbox/detalhes.

