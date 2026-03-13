

## Quick Flow — Correção de UX (Rodada Mínima)

### Resumo do Problema

O Quick Flow atual tem 3 problemas concretos: (1) estados `completed` e `error` colapsam de volta em `ready`, gerando ambiguidade visual e CTAs duplicados; (2) existe ação "Adicionar a avatar existente" que foge do escopo; (3) hierarquia de CTAs pós-resultado está invertida (regenerar aparece antes de criar avatar).

### Mudanças Planejadas (arquivo único: `src/pages/QuickFlow.tsx`)

**1. Máquina de estados explícita**
- Tipo `Step` passa de `"idle" | "uploading" | "ready" | "generating" | "tracking"` para incluir `"completed" | "error"`
- Quando tracking detecta `isCompleted` → `setStep("completed")`
- Quando tracking detecta `isFailed` → `setStep("error")`
- `generateMutation.onError` → `setStep("error")`

**2. CTAs por estado**
- `ready`: botão principal "Gerar Variação" visível
- `completed`: botão principal escondido; ações pós-resultado na coluna direita com hierarquia correta
- `error`: botão principal escondido; "Tentar novamente" + "Trocar imagem" + "Recomeçar" na coluna direita
- `generating`/`tracking`: botão principal desabilitado

**3. Hierarquia pós-resultado (completed)**
- Primário (default): "Criar novo avatar com esta variação" (com ícone UserPlus)
- Secundário (outline): "Gerar outra variação"
- Secundário (outline): "Baixar imagem" (download via fetch/blob)
- Terciário (ghost): "Recomeçar"

**4. Remoções**
- `AddToAvatarModal` — componente inteiro removido
- Estado `actionModal: "add"` — removido
- `addToAvatarMutation` — removido
- Imports `UserCheck`, `Select*`, `useAvatarProfiles` — removidos (se não usados em outro lugar)

**5. Modal "Criar Avatar" — clareza visual**
- Título: "Criar avatar a partir da variação"
- Thumbnail da variação (`resultUrl`) exibida no modal para deixar claro qual imagem será usada
- Copy auxiliar: "A variação gerada será usada como imagem de referência do novo avatar."

**6. Botão de download**
- Mesmo padrão fetch/blob do Avatar Details
- Aparece como ação secundária pós-resultado

**7. Link "Ver avatares"**
- Link discreto no header da página (abaixo do subtítulo ou ao lado), apontando para `/avatars`
- Estilo `text-sm text-muted-foreground hover:underline`, não compete com CTAs

**8. Copy atualizada**
- Subtítulo: "Envie uma imagem, gere uma variação e decida: crie um novo avatar ou apenas baixe o resultado."
- Empty state direita (sem referência): "Selecione uma imagem de referência para começar"
- Empty state direita (com referência): "Clique em \"Gerar Variação\" para criar uma variação"

**9. Estado de erro isolado**
- Coluna direita mostra: ícone erro + mensagem + "Tentar novamente" (outline) + "Trocar imagem" (ghost) + "Recomeçar" (ghost)
- Botão principal centralizado fica escondido quando `step === "error"`

### Dependências de Backend (não resolvidas nesta rodada)

- `create-avatar-profile` usa `referenceAssetIds: [assetId]` (a imagem original). Se o objetivo é criar avatar a partir da **variação**, seria necessário que `result_asset_id` esteja populado na generation, ou que o frontend faça upload da `resultUrl` como novo asset. **Nesta rodada**: mantém comportamento atual (usa original como referência) mas a copy diz "variação" — anotar como dívida técnica.
- Validação de `toolType: "quick_similar_image"` no backend precisa estar implementada no `create-generation`.

