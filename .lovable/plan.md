
# Nomes amigáveis de modelo no Inspector

## O que muda

1. **Criar função `getFriendlyModelName`** no `ImageDetailModal.tsx` que mapeia `image_model` + `thinking_level` para nomes amigáveis:
   - `gemini-3-pro-image-preview` → "Nano Banana Pro"
   - `gemini-3.1-flash-image-preview` + `high` → "Nano Banana 2 High"
   - `gemini-3.1-flash-image-preview` + `minimal` → "Nano Banana 2 Fast"
   - `gemini-3.1-flash-image-preview` + outro/ausente → "Nano Banana 2"
   - Qualquer outro valor → mostrar valor técnico como fallback

2. **Atualizar `getModelUsed`** para também retornar o `thinking_level` extraído de `ai_parameters.thinking_level` ou `_debug.thinking_level`.

3. **Resumo da geração** (linha ~259): trocar `models.image_model` pelo nome amigável no texto "Modelo: X".

4. **MetaRow "Modelo de imagem"** (linha ~363): mostrar nome amigável em vez do valor técnico bruto.

5. **Detalhes técnicos** (seção colapsável): adicionar uma linha com o `image_model` técnico original + `thinking_level` para quem quiser inspecionar.

## Arquivos alterados

- `src/components/avatar/ImageDetailModal.tsx` — única alteração

## O que NÃO muda

- Wizard de Nova Geração, Quick Flow, pipeline, exclusão, navegação.
