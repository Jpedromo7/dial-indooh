# Migração do Supabase para Neon e Cloudflare R2

Esta migração mantém o Supabase disponível como retorno até a validação final. Não exclua nem pause o projeto antigo antes de concluir a seção de validação.

## 1. Criar o banco no Neon

Crie um projeto PostgreSQL no Neon e copie as duas conexões com SSL:

- conexão com pool para `DATABASE_URL`;
- conexão direta para `DIRECT_URL`.

Crie a estrutura no banco novo sem inserir dados:

```powershell
$env:DATABASE_URL="CONEXAO_DIRETA_DO_NEON"
$env:DIRECT_URL="CONEXAO_DIRETA_DO_NEON"
npx prisma db push --schema prisma/schema.prisma
```

Copie os dados. O comando é repetível e faz atualização por `id`, sem apagar linhas:

```powershell
$env:SOURCE_DATABASE_URL="CONEXAO_DIRETA_DO_SUPABASE"
$env:TARGET_DATABASE_URL="CONEXAO_DIRETA_DO_NEON"
npm run migrate:postgres
```

## 2. Criar o bucket no Cloudflare R2

Crie o bucket `dial-indooh-media`, habilite uma URL pública ou domínio próprio e gere um token S3 limitado a esse bucket com permissão de leitura e escrita.

Configure o CORS do bucket, substituindo a origem pelo endereço real do painel:

```json
[
  {
    "AllowedOrigins": ["https://SEU-PAINEL.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Copie as mídias e atualize as URLs no banco novo. O comando ignora objetos que já existam no R2 com o mesmo tamanho:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://PROJETO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="CHAVE_DE_SERVICO_DO_SUPABASE"
$env:TARGET_DATABASE_URL="CONEXAO_DIRETA_DO_NEON"
$env:R2_ACCOUNT_ID="CONTA_CLOUDFLARE"
$env:R2_ACCESS_KEY_ID="CHAVE_R2"
$env:R2_SECRET_ACCESS_KEY="SEGREDO_R2"
$env:R2_PUBLIC_URL="https://URL-PUBLICA-DO-BUCKET"
$env:MEDIA_STORAGE_BUCKET="dial-indooh-media"
npm run migrate:storage
```

## 3. Virar a produção

Na Vercel, altere as variáveis e publique novamente:

```text
DATABASE_URL=conexão com pool do Neon
DIRECT_URL=conexão direta do Neon
MEDIA_STORAGE_PROVIDER=r2
MEDIA_STORAGE_BUCKET=dial-indooh-media
MEDIA_STORAGE_PUBLIC_URL=https://URL-PUBLICA-DO-BUCKET
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

Mantenha temporariamente as três variáveis do Supabase. Elas permitem retornar o upload para `MEDIA_STORAGE_PROVIDER=supabase` durante a janela de validação.

## 4. Validar

1. Entrar no painel administrativo.
2. Conferir contagens de telas, playlists e mídias.
3. Enviar uma imagem e um vídeo novos.
4. Criar uma playlist de teste e atribuí-la a uma TV.
5. Confirmar download, cache e reprodução na TV.
6. Manter o Supabase intacto por pelo menos 48 horas.

## Retorno

Se o upload falhar, restaure `MEDIA_STORAGE_PROVIDER=supabase` e a antiga `MEDIA_STORAGE_PUBLIC_URL`. Se o banco falhar, restaure `DATABASE_URL` e `DIRECT_URL` do Supabase. Publique novamente; não é necessário alterar o código.

Depois da janela de validação, remova as variáveis e dependências do Supabase em uma alteração separada. A exclusão do projeto antigo deve ser autorizada explicitamente.
