
Implementação proposta para o Quick Flow:

1. Fonte de dados dos detalhes
- Estender `useGenerationStatus` para buscar, além do que já existe:
  - da `generations`: `pipeline_type`, `source_mode`, `tool_type`, `started_at`, `finished_at`, `created_at`, `status`, `ai_parameters`, `extracted_prompt`, `result_url`, `error_code`
  - de `generation_jobs`: `input_payload`, `output_payload`, `error_payload`, `provider`, `model`, `step`, `status`, `id`, timestamps
- Manter polling só quando a geração ainda estiver ativa, como já acontece.

2. Painel lateral de detalhes
- Criar um componente dedicado para o Quick Flow, reaproveitando padrões visuais do `ImageDetailModal`.
- Usar o componente lateral já existente em `src/components/ui/sheet.tsx` para abrir um painel à direita com overlay, em vez do `drawer.tsx` atual que é bottom sheet.
- Largura alvo: `sm:max-w-[380px]` / ~350–400px.

3. Acesso pelo card da variação ativa
- Adicionar um botão pequeno de info/detalhes sobreposto no canto superior direito da imagem principal da variação.
- O botão só aparece quando existir uma variação selecionada/ativa.
- Clique abre o painel sem alterar lightbox nem layout principal.

4. Conteúdo do painel
- Seção “Prompt utilizado”
  - Resolver o prompt com fallback:
    1. prompt final em `generation_jobs.input_payload`
    2. campos úteis em `generations.ai_parameters`
    3. `generations.extracted_prompt`
  - Exibir em bloco com fundo sutil, altura limitada e scroll.
  - Botão “Copiar” com feedback visual.
- Seção “Detalhes da geração”
  - Modelo
  - Provider
  - Tipo / source mode
  - Pipeline type
  - Status humanizado
  - Data/hora
  - Dimensões se existirem em `output_payload` ou metadados persistidos
- Seção “Informações de contexto”
  - Contagem de imagens de referência enviadas ao provider: no Quick Flow exibir `0`
  - Indicar “Prompt reutilizado de geração anterior” quando `reusePromptFromGenerationId` existir em algum `input_payload`
- Seção “Detalhes técnicos” colapsada por padrão
  - `generation.id`
  - `job.id` (job mais relevante/final)
  - `pipeline_type`
  - `source_mode`
  - `tool_type`
  - payloads/metadados úteis resumidos, sem poluir a UI

5. Atualização ao trocar thumbnail
- Vincular o painel à `activeVar`.
- Se o painel estiver aberto e o usuário clicar em outra thumbnail, manter aberto e recarregar os dados da nova geração automaticamente.

6. Regras de apresentação
- Humanizar labels e status no painel.
- Não expor chaves técnicas cruas como experiência principal; deixar valores brutos só na área técnica colapsável.
- Mostrar loading/skeleton enquanto os detalhes da geração ativa carregam.
- Tratar ausência de dados com `—` em vez de blocos vazios.

7. Arquivos a ajustar
- `src/hooks/useGenerationStatus.ts`
  - ampliar tipos e query para incluir os campos necessários
- `src/pages/QuickFlow.tsx`
  - estado do painel aberto/fechado
  - botão overlay na imagem ativa
  - hook de detalhes da geração ativa
  - renderização do painel
- Novo componente sugerido:
  - `src/components/quick-flow/QuickFlowGenerationDetailsSheet.tsx`
  - encapsula parsing dos dados, layout do painel e ações de copiar

8. Observações importantes do código atual
- Hoje o Quick Flow só usa `useGenerationStatus(..., { skipDetails: true })`, então não há dados suficientes para o painel.
- O `drawer.tsx` atual não atende ao requisito lateral; o `sheet.tsx` já entrega exatamente o comportamento pedido.
- O histórico, lightbox e fluxo de geração não precisam ser alterados para esta feature.
