

## Refatoração do Quick Flow — Plano de Implementação

### Visão Geral

Reescrever `src/pages/QuickFlow.tsx` como um fluxo de 2 colunas: esquerda = imagem de referência (dropzone → preview), direita = resultado da variação (empty state → loading → resultado). Upload automático em background ao selecionar imagem. Payload corrigido para o contrato `create-generation`.

---

### Layout Desktop (2 colunas)

```text
┌──────────────────────┬──────────────────────┐
│   REFERÊNCIA         │   VARIAÇÃO           │
│                      │                      │
│  [dropzone/preview]  │  [empty/loading/img] │
│                      │                      │
│  "Trocar imagem"     │  ações pós-resultado │
└──────────────────────┴──────────────────────┘
         [ Gerar Variação ]  (centralizado)
```

Mobile: stack vertical (referência em cima, resultado embaixo).

---

### Fluxo de Estados

1. **idle** — dropzone visível à esquerda, empty state à direita
2. **uploading** — preview local imediato + spinner discreto no canto da imagem + dropzone substituído pela preview
3. **ready** — upload concluído, botão "Gerar Variação" habilitado, "Trocar imagem" disponível
4. **generating** — botão desabilitado, placeholder/skeleton animado à direita
5. **completed** — resultado à direita + ações: "Gerar outra variação", "Criar avatar", "Adicionar a avatar existente"
6. **error** — mensagem inline na coluna direita, botão "Tentar novamente"

---

### Correção do Payload

O payload atual está errado (`toolType: "quick_generation"`, `pipelineType: "image_to_image"`, `sourceMode: "quick_flow"`). Corrigir para:

```typescript
{
  toolType: "quick_similar_image",
  pipelineType: "multimodal_image_generation",
  sourceMode: "single_asset",
  avatarProfileId: null,
  referenceAssetIds: [uploadedAssetId],
  supportingAssetIds: [],
  input: {
    promptPackId: "ugc-avatar-reference-pack-v1",
    shotId: "medium_front",
    geminiPreferredModel: "gemini-3-pro-image-preview",
  },
}
```

---

### Mudanças Específicas (arquivo único: `src/pages/QuickFlow.tsx`)

1. **Remover** botão "Enviar Imagem" separado — upload dispara automaticamente em `handleFileChange`
2. **Simplificar estados** para: `idle | uploading | ready | generating | tracking`
3. **Layout 2 colunas**: `grid grid-cols-1 md:grid-cols-2 gap-6`
4. **Coluna esquerda**: dropzone quando idle, preview + "Trocar imagem" quando tem arquivo
5. **Coluna direita**: empty state amigável → skeleton durante geração → imagem resultado
6. **Botão "Gerar Variação"** abaixo do grid, centralizado, habilitado só quando `step === "ready"`
7. **Ações pós-resultado**: "Gerar outra variação" (reseta generationId, mantém referência), "Criar avatar", "Adicionar a avatar"
8. **Regeneração**: mantém assetId/assetUrl, só reseta generationId e step para "ready"
9. **Erro inline**: Alert na coluna direita, nunca blank screen
10. **Manter** os sub-modais `CreateAvatarFromResultModal` e `AddToAvatarModal` inalterados
11. **Remover** o `GenerationStatusPanel` pesado — usar polling simples do `useGenerationStatus` para mostrar progress bar inline na coluna direita

---

### Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/QuickFlow.tsx` | Reescrita do layout e lógica (único arquivo modificado) |

Nenhum outro componente, hook, edge function ou pipeline é alterado.

---

### Riscos e Mitigações

- **Payload incorreto** é a causa raiz do erro atual — corrigido diretamente no `mutationFn`
- **Upload automático** pode falhar silenciosamente — tratar com toast de erro e retorno ao estado idle
- **Regeneração** deve preservar o asset original — resetar apenas `generationId`, não `assetId`
- Nenhum impacto em Avatar Details, NewGenerationModal ou outros fluxos

