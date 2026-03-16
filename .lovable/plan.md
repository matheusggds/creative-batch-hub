
Objetivo: aplicar apenas os fixes pendentes em Quick Flow e Avatar Workspace, sem mexer no layout principal, lightbox, drawer de detalhes ou backend.

1. Quick Flow — trocar infinite scroll por botão “Carregar mais”
- Arquivo: `src/components/quick-flow/QuickFlowHistory.tsx`
- Remover `IntersectionObserver`, `useRef` e `useEffect` do histórico.
- Manter a grid atual e substituir o sentinel por um botão centralizado abaixo da lista.
- O botão:
  - chama `fetchNextPage`
  - usa estilo discreto/secundário
  - mostra spinner enquanto `isFetchingNextPage`
  - some quando `hasNextPage` for false
- `src/hooks/useQuickFlowHistory.ts` já pagina em blocos de 12, então a lógica de dados pode permanecer praticamente igual.

2. Quick Flow — confirmar contagem do histórico só com `completed`
- Arquivo: `src/hooks/useQuickFlowHistory.ts`
- A contagem já está correta hoje: `variationCount` usa apenas itens com `status === "completed"` e com resultado válido.
- Na implementação eu só manteria isso intacto e, se necessário, ajustaria comentários para refletir o comportamento real.

3. Quick Flow — resetar seletor ao restaurar sessão
- Arquivo: `src/pages/QuickFlow.tsx`
- Isso também já está implementado em `applyRestore` com `setSelectedCount(1)`.
- Não precisa mudar lógica; apenas preservar esse comportamento durante os demais ajustes.

4. Quick Flow — thumbnails com scroll horizontal real e affordance visual
- Arquivo: `src/pages/QuickFlow.tsx` no componente `VariationThumbnailStrip`
- Manter uma única linha horizontal (`flex-nowrap` / `shrink-0` já está próximo disso).
- Melhorar o container para:
  - largura total da coluna
  - `overflow-x-auto`
  - impedir quebra em múltiplas linhas
  - aplicar padding/spacing compacto
- Adicionar um indicador sutil de continuidade horizontal:
  - opção simples e segura: fade lateral à direita com gradiente sobreposto
  - opcionalmente exibir também à esquerda quando houver scroll
- Garantir que as thumbnails não “espremam” e continuem com largura fixa.

5. Avatar Workspace — typos
- Busca no código atual não encontrou mais `imagemns` nem `geraçãoões`.
- Os pontos anteriormente problemáticos já estão corretos:
  - `src/pages/AvatarDetails.tsx`
  - `src/components/avatar/NewGenerationModal.tsx`
  - `src/components/avatar/GenerateBaseAnglesModal.tsx`
- Portanto, não há correção real pendente aqui, apenas validar e não regredir.

Arquivos a ajustar
- `src/components/quick-flow/QuickFlowHistory.tsx`
- `src/pages/QuickFlow.tsx`

Validação esperada após implementação
- Histórico carrega 12 sessões iniciais e só busca mais ao clicar em “Carregar mais”.
- O botão desaparece quando acabar a paginação.
- As contagens do histórico continuam mostrando apenas gerações concluídas.
- Restaurar uma sessão continua resetando o seletor para `1`.
- Com muitas variações, a faixa de thumbnails permanece em uma única linha com scroll horizontal e indicação visual de que há mais itens fora da área visível.
- Nenhuma mudança visual estrutural fora desses pontos.
