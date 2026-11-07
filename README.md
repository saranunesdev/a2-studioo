# A2 Tattoo Studio · Eventos

App de flash tattoo em eventos: catálogo no QR code, ficha de saúde no celular, fila com aviso na hora e toda a gestão do evento (agenda, equipe, checklist, orçamento, treino, fechamento e pós-tattoo).

Funciona no navegador, no celular e no computador. O cliente **não precisa instalar app nem fazer login**.

## Três acessos

| Acesso | Quem | Como entra | O que vê |
|---|---|---|---|
| **Gestão** | Dona do estúdio | Direto, sem login | Tudo: Agenda, Hoje, Pós, Equipe, Ajustes, eventos com orçamento, contratos e fechamento |
| **Atendimento** | Balcão no dia do evento | PIN criado em Ajustes | **Só o evento aberto hoje**: fila, pagamentos, fichas, “Novo cliente” (preencher pelo cliente no tablet) e tela da mesa |
| **Cliente** | Público do evento | QR code, sem login | Catálogo, ficha (português e inglês), código, posição na fila e chamada em tela cheia |

Também há o **telão** (`/fila`), sem nomes nem dados pessoais.

## Rodar no computador

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Sem configurar nada, o app roda em **modo demonstração**: os dados ficam no navegador, e abas do mesmo aparelho ficam sincronizadas (dá para abrir o cliente numa aba e a gestão em outra). PIN de exemplo do atendimento: `2468` (troque em Ajustes).

> No modo demonstração o QR code **não** conecta outros celulares, porque cada aparelho tem os próprios dados. Para isso, conecte o Supabase.

## Conectar de verdade (Supabase + Vercel)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor, rode `supabase/migrations/0001_a2.sql`.
3. Rode também `supabase/migrations/0002_gestao_sem_login.sql`, que deixa a gestão sem login.
4. Gere os dados iniciais e rode o arquivo gerado no SQL Editor:
   ```bash
   node scripts/make-seed-sql.mjs seu@email.com
   ```
   O comando mostra o PIN do atendimento. O arquivo `supabase/seed.sql` não vai para o Git.
5. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings › API).
6. Na Vercel, importe o repositório, adicione as mesmas duas variáveis e publique. O `vercel.json` já cuida das rotas.
7. No app publicado, em Ajustes › Estúdio, preencha o **Link público do app**. É ele que vai no QR code.

### Regras de acesso no banco

> **Atenção:** a gestão está sem login, por decisão da dona do estúdio. Qualquer pessoa com o link do app (ou com a chave pública) pode ler e mudar todas as tabelas, inclusive as fichas de saúde. Para voltar a proteger, desfaça `0002_gestao_sem_login.sql`.

- A gestão lê e grava as tabelas, sem login.
- O atendimento nunca lê as tabelas: usa só funções que conferem o PIN e devolvem o evento aberto hoje (`a2_desk`, `a2_queue`, `a2_submit_ticket`).
- O cliente usa `a2_public_live` (fila sem dados pessoais), `a2_submit_ticket` e `a2_get_ticket` (o próprio pedido, por um id secreto guardado no celular). O preço é sempre o dos Ajustes, nunca o que vem do celular.
- Cada operação da fila trava o evento no banco, então duas mesas liberando ao mesmo tempo nunca chamam o mesmo cliente.

## Acessibilidade e identidade

- Paleta da marca: `#0A0A0A`, `#1C1C1C`, `#333333`, `#BFBFBF`, `#FFFFFF`. `#333333` só em bordas decorativas, nunca em texto. Campos e botões vazados usam borda `#BFBFBF` para ficarem visíveis.
- Títulos em Playfair Display (Didot quando houver), textos em Montserrat (Lato de reserva).
- Texto com no mínimo 16 px e botões com no mínimo 44 px de altura.
- Campos com rótulo visível e erros escritos em texto.
- A situação da fila aparece por escrito (“Sua vez — Mesa 2”), não só pela cor.
- Cada desenho do catálogo tem texto alternativo (“Borboletas nº 05, traço fino, até 5 cm”).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checa os tipos e gera `dist/` |
| `npm test` | Testes (Vitest): fila, regras, textos e recortes de acesso |
| `npm run lint` | ESLint |
| `npm run extract` | Recria `public/flash/` e `src/data/` a partir de `prototipo/a2-eventos.html` |

## Pastas

```
prototipo/          protótipo original (referência; 4 MB de imagens)
public/flash/       60 pranchas de flash (extraídas do protótipo)
scripts/            extração das pranchas e geração do seed do Supabase
supabase/migrations tabelas, regras de acesso e funções da fila
src/data/           catálogo (recortes), constantes e dados de exemplo
src/lib/            regras de negócio puras, textos, fila, idiomas (com testes)
src/store/          banco de dados: modo local e Supabase, mesma interface
src/screens/        gestão, atendimento, cliente/telão e telas do dia (fila e mesa)
src/styles/         tokens da marca e estilos
```
