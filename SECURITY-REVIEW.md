# Relatório de revisão de segurança

**Data:** 31/10/2026  
**Escopo:** revisão estática do repositório, com foco em controles de acesso, autenticação, Supabase/RLS, exposição de dados e configuração. Nenhum código, teste ou aplicação foi executado.

## Achados

| # | Severidade | Arquivo e linhas | Categoria | Achado e impacto | Confiança |
|---|---|---|---|---|---|
| 1 | 🔴 HIGH | [`supabase/migrations/20240421000000_database_relationship_fix.sql`](supabase/migrations/20240421000000_database_relationship_fix.sql), linhas 50, 68 e 94 | Controle de acesso | Políticas `FOR ALL USING (true) WITH CHECK (true)` em `investments`, `incoming` e `users` não restringem o acesso a um papel autenticado. Políticas permissivas posteriores não removem essas políticas; se a migração de hardening não tiver sido aplicada e as permissões padrão do Supabase estiverem ativas, chamadas não autenticadas podem ler ou alterar dados financeiros. | 8/10 |
| 2 | 🟡 MEDIUM | [`app/api/user/update-profile/route.ts`](app/api/user/update-profile/route.ts), linhas 4–34 | Controle de acesso | A rota não autentica a chamada, aceita `userId` no corpo e usa o cliente administrativo para atualizar perfil e email. Conhecendo o UUID de uma vítima, um solicitante pode tentar alterar esses dados. A exploração depende de `SUPABASE_SERVICE_ROLE_KEY` estar configurada e o impacto da alteração do email depende das configurações de confirmação do Supabase. | 9/10 |
| 3 | 🟡 MEDIUM | [`supabase/migrations/20240424000006_robust_rls.sql`](supabase/migrations/20240424000006_robust_rls.sql), linhas 78–80 | Controle de acesso | A política permite que um usuário autenticado atualize sua própria linha em `users` com base no email, sem restringir as colunas. Assim, pode ser possível alterar `status` para `Ativo` e contornar a verificação de ativação usada no login. | 9/10 |
| 4 | 🟡 MEDIUM | [`app/despesas/page.tsx`](app/despesas/page.tsx), linhas 385–390; [`app/investimentos/page.tsx`](app/investimentos/page.tsx), linhas 243–246; [`app/receitas/page.tsx`](app/receitas/page.tsx), linhas 346–351 | Exposição de segredo | As telas cliente leem `NEXT_PUBLIC_GEMINI_API_KEY` e instanciam o SDK Gemini no navegador. Se configurada, a chave é exposta ao público e pode ser reutilizada, consumindo a cota do projeto. | 10/10 |

## Recomendações

1. Criar uma migração versionada que remova as políticas permissivas, restrinja operações a papéis apropriados e valide as políticas RLS efetivas.
2. Exigir autenticação nas rotas de perfil, obter a identidade de uma sessão verificada e autorizar alterações administrativas explicitamente.
3. Restringir atualizações próprias de `users` às colunas de perfil permitidas e reservar mudanças de `status` para administradores.
4. Manter a chave Gemini no servidor e intermediar chamadas por uma rota autenticada com controles de uso.

## Limitações

Esta revisão foi estática. Não foi possível confirmar o estado das políticas aplicadas no banco de produção, as permissões do projeto Supabase, os segredos configurados nem as opções de confirmação de email. Portanto, o primeiro e o segundo achados incluem condições de configuração que precisam ser verificadas no ambiente implantado. A revisão não substitui validação dinâmica ou confirmação de configuração.
