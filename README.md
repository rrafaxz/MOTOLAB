# Motolab

CRM de vendas de motos. Interface baseada no Figma Motolab, em Inter, com três modos de visualização por área no desktop. Retornos, caixa e atribuição trabalham com datas de Brasília. Valores financeiros são gravados em centavos.

## Rodar no Mac

Requer Node.js 22.12 ou superior. A versão 24 está indicada no arquivo .nvmrc.

    npm install
    cp .env.example .env.local
    npm run dev
    npm test
    npm run build

A demonstração usa apenas dados fictícios e o armazenamento do navegador. A configuração de URL e chave pública ativa a autenticação e a persistência real, com restrição por espaço.

## Ligar ao Supabase

1. Crie um projeto Free dedicado e execute supabase/schema.sql uma vez no SQL Editor.
2. Desative o cadastro público. Crie as contas autorizadas em Authentication com acesso por e-mail e senha.
3. Ajuste os e-mails em supabase/primeiro-espaco.sql e aplique o script uma vez.
4. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em .env.local ou no ambiente do host. Defina VITE_DEMO=false. A chave é a publishable do projeto. Use a conta criada no passo 2 para entrar.
5. Antes de inserir dados reais, confira com duas contas de espaços diferentes o isolamento dos registros e dos anexos.

## Implantação

Importe o repositório como projeto Vite na Vercel. O build gera dist. Configure as duas variáveis VITE_SUPABASE antes do build. O plano Hobby da Vercel é para uso pessoal e não comercial. O app é estático e o mesmo build pode ser publicado em um host estático cujo plano gratuito comporte uso comercial.

## Regras

- Agendar a partir de um lead troca a pendência anterior e mantém o histórico; fechar a venda encerra os retornos.
- Um recebimento é separado da comissão prevista. Parcelas são aceitas até o saldo da venda. Valores registrados entram no caixa na data em que foram pagos.
- CAC e ROI consideram mídia e custos diretos na janela selecionada e vinculam vendas aos leads de anúncio originados nessa janela. A comissão de marketing entra pelo que já foi recebido das vendas atribuídas. Um recebimento de dezembro pode entrar no ROI dos leads de novembro e aparece no caixa de dezembro.
- WhatsApp abre a conversa em outra aba. A troca de mensagens acontece por lá.
- Anexos são privados e abrem por URL temporária. Use evidências sem documentos pessoais desnecessários.
- As telas calculam a fila e os indicadores na abertura e depois dos lançamentos.
