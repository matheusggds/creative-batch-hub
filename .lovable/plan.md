

# UGC Creator Studio — Fase 1: Avatar Studio Mockado

## Visão Geral
SaaS para criação em massa de UGC (User Generated Content) focado em TikTok Shop. Fase 1 implementa o fluxo de "Image-to-Image" (troca de roupa) com processamento em lote mockado, modelagem relacional robusta e interface "Creator Studio" em dark mode.

---

## 1. Banco de Dados & Storage (Supabase)

### Tabelas
- **`assets`** — Biblioteca permanente de ativos do usuário (avatares, roupas, produtos) com `type`, `file_url`, vinculada ao `user_id`
- **`generation_batches`** — Agrupador de gerações para testes A/B, com status (`pending` → `processing` → `completed`)
- **`generations`** — Cada geração individual vinculada a um batch, com referências aos assets base/referência, campo JSONB `ai_parameters` (aspect_ratio, prompts, seeds), `result_url` nullable e status granular incluindo `failed`
- **`user_roles`** — Tabela de roles separada (seguindo regras de segurança)

### Storage
- Bucket público **`ugc-assets`** para uploads de imagens

### Segurança (RLS)
- Todas as tabelas com políticas restritas a `auth.uid()` para SELECT, INSERT e UPDATE
- Bucket com políticas de acesso por usuário autenticado

---

## 2. Autenticação
- Tela de login/signup simples com email e senha usando Supabase Auth
- Tabela `profiles` para dados básicos do usuário (display name, avatar)
- Redirecionamento automático para `/studio` após login

---

## 3. Interface — Rota `/studio`

### Layout
- Design dark mode com estética "Creator Studio"
- Layout dividido em duas colunas para produtividade

### Coluna Esquerda — Setup & Parâmetros
- **Avatar Base**: Upload de imagem (salva em `assets` tipo `avatar`) ou seleção de mini-galeria com avatares existentes do usuário
- **Referência de Roupa**: Upload ou seleção da galeria, com suporte a **múltiplas seleções** simultâneas para gerar lotes (tipo `clothing`)
- **Acordeão "Advanced AI Settings"** (fechado por padrão):
  - Input "Prompt de Estilo"
  - Input "Negative Prompt"
  - Select "Aspect Ratio" (default 9:16, opções: 9:16, 1:1, 16:9, 4:5)
  - Estes valores alimentam o campo JSONB `ai_parameters`
- **Botão "Gerar Variações em Lote"** — cria batch + generations no banco

### Coluna Direita — Resultados Reativos
- Feed de histórico de lotes (`generation_batches`) ordenado por data
- Resultados agrupados em grids por lote (cards com thumbnail)
- Cada card com botão desabilitado "🎬 Enviar para Vídeo" (placeholder Fase 2)
- Skeleton loaders durante processamento

---

## 4. Lógica de Mock (Sem Edge Functions)
- Upload real de imagens para o Storage Supabase
- Registro real em `assets`, `generation_batches` e `generations`
- Campo JSONB `ai_parameters` preenchido com os parâmetros do formulário
- Simulação de processamento com `setTimeout` de 4 segundos
- Após timeout: status atualizado para `completed` no banco + imagens placeholder exibidas
- React Query para reatividade e cache dos dados

---

## 5. Navegação
- Rota `/` — Login/Signup
- Rota `/studio` — Interface principal (protegida por auth)
- Rota catch-all — 404

