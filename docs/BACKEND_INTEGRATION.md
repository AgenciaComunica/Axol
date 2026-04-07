# Integração Frontend x Backend

Documento de apoio para o time de backend integrar o fluxo operacional do sistema Axol.

Escopo:
- rotas do frontend
- parâmetros de URL
- eventos de clique relevantes
- ações que hoje ainda estão em mock/local state
- pontos que devem ser substituídos por API

Arquivos-base do mapeamento:
- `src/router/index.ts`
- `src/views/DashboardView.vue`
- `src/views/TransformerListView.vue`
- `src/views/TransformerReportView.vue`
- `src/components/SideMenu.vue`

## 1. Visão Geral

Hoje o frontend já possui a navegação e os fluxos de CRUD simulados localmente. Em vários pontos, o comportamento visual está pronto, mas o dado ainda está:
- vindo de JSON local
- salvo apenas em memória
- persistido apenas em `localStorage` para preferências de coluna
- sem integração real de exportação

Objetivo do backend:
- assumir a leitura dos dados
- assumir o salvamento das entidades operacionais
- responder aos filtros, ordenação e paginação
- viabilizar exportações e geração de relatório

## 2. Rotas do Frontend

Definição atual em `src/router/index.ts`.

| Rota | Nome | View | Uso |
|---|---|---|---|
| `/` | `dashboard` | `DashboardView.vue` | Painel principal com mapa, KPIs e modal do transformador |
| `/viewer-3d` | `viewer-3d` | `Viewer3DView.vue` | Visualização 3D do transformador |
| `/relatorio/:id` | `transformer-report` | `TransformerReportView.vue` | Relatório por transformador |
| `/transformadores` | `transformer-list` | `TransformerListView.vue` | Lista geral de transformadores |
| `/analises` | `analises-view` | `TransformerReportView.vue` | Visão global de análises |
| `/tratamento-oleo` | `tratamento-oleo-view` | `TransformerReportView.vue` | Visão global de tratamento de óleo |
| `/coletas` | `coletas-view` | `TransformerReportView.vue` | Visão global de coletas |

## 3. Contrato de URL

### 3.1 Dashboard

Rota:
- `/`

Query params usados:
- `transformer`

Uso:
- ao clicar em `Localizar` ou voltar do relatório/lista, o front pode abrir o painel já focado em um transformador específico

Exemplo:
- `/?transformer=MG-9701-A01`

### 3.2 Viewer 3D

Rota:
- `/viewer-3d`

Query params usados:
- `trafoId`
- `lat`
- `lng`
- `munCode`

Exemplo:
- `/viewer-3d?trafoId=MG-9701-A01&lat=-23.6&lng=-46.7&munCode=3106200`

Observação:
- além da URL, o frontend também envia `postMessage` para o iframe com `type: 'SET_TRAFO'`

Payload atual do `postMessage`:

```json
{
  "type": "SET_TRAFO",
  "payload": {
    "id": "MG-9701-A01",
    "lat": -23.6,
    "lng": -46.7,
    "munCode": "3106200"
  }
}
```

### 3.3 Relatório por transformador

Rota:
- `/relatorio/:id`

Path params:
- `id`: identificador do transformador

Query params usados:
- `section`
- `macro`

Valores atuais de `section`:
- `Avaliação Completa`
- `Histórico de Análises`
- `Avaliações Complementares`
- `Coletas`
- `Tratamento de Óleo`

Valores atuais de `macro`:
- `TR-Óleo`
- `TR-OLTC`
- `TR-Rota`

Exemplos:
- `/relatorio/MG-9701-A01?section=Avaliação%20Completa&macro=TR-Óleo`
- `/relatorio/MG-9701-A01?section=Histórico%20de%20Análises&macro=TR-OLTC`
- `/relatorio/MG-9701-A01?section=Coletas&macro=TR-Rota`

Regra atual:
- se `macro` não vier, o frontend assume `TR-Óleo`
- se `section` não vier, o frontend assume `Avaliação Completa`

### 3.4 Visões globais

Não usam `:id` e forçam uma aba específica:

| Rota | Aba forçada |
|---|---|
| `/analises` | `Histórico de Análises` |
| `/tratamento-oleo` | `Tratamento de Óleo` |
| `/coletas` | `Coletas` |

## 4. Macrotabs e subtabs do relatório

### 4.1 TR-Óleo

Subtabs:
- `Avaliação Completa`
- `Histórico de Análises`
- `Avaliações Complementares`
- `Coletas`
- `Tratamento de Óleo`

### 4.2 TR-OLTC

Subtabs:
- `Avaliação Completa`
- `Histórico de Análises`
- `Avaliações Complementares`
- `Coletas`
- `Tratamento de Óleo`

### 4.3 TR-Rota

Subtabs:
- `Avaliação Completa`
- `Histórico de Análises` exibida com label `Análise de Campo`
- `Coletas`

## 5. Eventos de Clique por Tela

## 5.1 Menu lateral

Arquivo:
- `src/components/SideMenu.vue`

Eventos:

| Clique | Ação |
|---|---|
| `Painel` | navega para `/` |
| `Transformadores` | navega para `/transformadores` |
| `Relatórios` | navega para o primeiro transformador conhecido em `/relatorio/:id?section=Avaliação Completa` |
| `Análises` | navega para `/analises` |
| `Tratamento Óleo` | navega para `/tratamento-oleo` |
| `Coletas` | navega para `/coletas` |

Observação importante:
- o item `Relatórios` hoje usa o primeiro transformador do JSON local, o que é provisório
- ideal backend: devolver um transformador default válido por usuário/tenant, ou o frontend deixar de depender disso

## 5.2 Dashboard

Arquivo:
- `src/views/DashboardView.vue`

Eventos principais:

| Clique | Ação |
|---|---|
| transformador no mapa/lista lateral | abre modal do transformador |
| `Ver 3D` | abre viewer 3D |
| `Ver relatório` | navega para `/relatorio/:id?section=Avaliação Completa` |
| `Localizar`/fixar rota | foco visual no ativo |
| fechar modal | fecha modal e limpa estado visual |

Integração backend necessária:
- listar transformadores e coordenadas
- status/KPIs por transformador
- dados do modal do transformador

## 5.3 Lista de Transformadores

Arquivo:
- `src/views/TransformerListView.vue`

Ações por botão:

| Clique | Ação atual | Expectativa backend |
|---|---|---|
| `Ordenado por` | ordena em memória | backend deve aceitar sort field + direction |
| `Filtro avançado` | abre modal de expressão | backend deve receber regras condicionais |
| `Colunas` | mostra/oculta colunas | preferência pode ficar no front ou migrar para backend |
| `Limpar Filtro` | reseta busca/ordenação/filtro/colunas | sem API obrigatória |
| `Novo` | UI presente | endpoint futuro de criação de transformador |
| `Exportar` | UI presente | endpoint futuro de exportação |
| `Localizar` | navega para dashboard com `?transformer=` | sem API adicional |
| menu `... > Avaliação Completa` | abre relatório na aba correspondente | sem API adicional |
| menu `... > Análises` | abre relatório em `Histórico de Análises` | sem API adicional |
| menu `... > Coletas` | abre relatório em `Coletas` | sem API adicional |
| menu `... > Tratamento` | abre relatório em `Tratamento de Óleo` | sem API adicional |
| menu `... > Editar` | abre modal de edição | endpoint de update do transformador |

### Modal de edição do transformador

Campos atuais:
- `id`
- `serial`
- `tag`
- `substation`
- `unit`
- `power`
- `voltage`
- `manufacturer`
- `year`
- `latitude`
- `longitude`

Estado atual:
- salvo apenas em memória (`transformerEdits`)

Expectativa backend:
- `GET /transformadores`
- `GET /transformadores/:id`
- `PATCH /transformadores/:id`

## 5.4 Relatório por transformador e visões globais

Arquivo:
- `src/views/TransformerReportView.vue`

### Ações do toolbar principal

| Clique | Ação atual | Expectativa backend |
|---|---|---|
| seletor de transformador | troca `:id` no contexto da tela | listar transformadores por subestação, com busca |
| macrotab `TR-Óleo` / `TR-OLTC` / `TR-Rota` | altera `macro` | sem API adicional, mas muda origem dos dados |
| `Localizar` | navega para dashboard com `?transformer=` | sem API adicional |
| `Gerar Relatório` | abre checklist e fecha menu | endpoint futuro de geração/download |
| `Ver em 3D` | abre modal 3D | backend não obrigatório, depende do viewer |

### Seções com colapso

Existem botões de expandir/recolher em:
- cards da `Avaliação Completa`
- cards da aba `Avaliações Complementares`
- bloco `Condições`
- bloco `Análises Recentes`
- bloco `Tabela Limite Para Ação Corretiva`

Esses cliques hoje são puramente visuais e não exigem backend.

## 6. Fluxos de dados por módulo

## 6.1 Especialista

Modal:
- `openSpecialistModal`
- `saveSpecialistModal`

Campos:
- `statusAnalyst`
- `analystNote`
- `failureMode`

Estado atual:
- salvo em memória em `specialistEdits`

Integração recomendada:
- `GET /transformadores/:id/especialista`
- `PUT /transformadores/:id/especialista`

## 6.2 Histórico de Análises

Abrange:
- cromatografia
- físico-químico
- ensaios especiais
- OLTC
- físico-químico OLTC

Controles visíveis:
- busca por texto
- `Ordenado por`
- `Filtro avançado`
- `Colunas`
- `Limpar Filtro`
- `Novo`
- `Exportar`
- paginação
- tabs de tipo
- switch `Padrão / OLTC`

### Evento `Novo > Nova Análise`

Modal atual muda conforme o contexto:

Modo padrão:
- `cromatografia`
- `fisicoquimico`
- `ensaiosespeciais`

Modo OLTC:
- `oltc`
- `fisicoquimicooltc`

Estado atual:
- `saveAnalysisModal()` ainda não persiste em lugar nenhum
- o modal está pronto, mas a integração ainda não foi feita

Integração recomendada:
- `GET /transformadores/:id/analises`
- `POST /transformadores/:id/analises/cromatografia`
- `POST /transformadores/:id/analises/fisico-quimico`
- `POST /transformadores/:id/analises/ensaios-especiais`
- `POST /transformadores/:id/analises/oltc`
- `POST /transformadores/:id/analises/oltc/fisico-quimico`

Para visão global:
- `GET /analises`

Filtros recomendados no backend:
- `transformerId`
- `macro`
- `tipo`
- `search`
- `page`
- `pageSize`
- `sortField`
- `sortDirection`
- `advancedRules[]`

### Exportação de análises

UI pronta:
- checkboxes por tipo
- botão `Baixar`

Estado atual:
- apenas fecha menu

Integração recomendada:
- `POST /analises/export`

## 6.3 Análise de Campo no TR-Rota

Contexto:
- dentro do macro `TR-Rota`
- aparece na subtab `Histórico de Análises`, com label visual `Análise de Campo`

Controles visíveis:
- busca por texto
- `Ordenado por`
- `Colunas`
- `Limpar Filtro`
- `Novo`
- paginação

### Evento `Novo`

Abre o modal `Nova Análise de Campo`.

Etapas atuais:
- `Identificação da coleta`
- `Status do transformador`
- `Temperaturas`
- `Sistema estrutural`
- `Preservação de óleo`
- `Sistema de conexão`
- `Sistema de ativo`

Campos atuais:
- `dataColeta`
- `tecnico`
- `operando`
- `acesso`
- `identificacao`
- `tempOleo`
- `tempEnrolamento`
- `tempAmbiente`
- `limpeza`
- `corrosao`
- `pintura`
- `aterramento`
- `vazamentos`
- `conservador`
- `nivelOleo`
- `secador`
- `conexoesAt`
- `conexoesBt`
- `tempPrimario`
- `tempSecundario`
- `vibracao`

Estado atual:
- salvo em memória em `manualRouteInspectionRows`

Integração recomendada:
- `GET /transformadores/:id/rota/analises-campo`
- `POST /transformadores/:id/rota/analises-campo`

Para visão global futura, se necessário:
- `GET /rota/analises-campo`

## 6.4 Coletas

Controles visíveis:
- filtro por quarter
- filtro por mês
- filtro por ano
- `Ordenado por`
- `Filtro avançado`
- `Limpar Filtro`
- `Novo`
- `Exportar`
- tabs `Próximas` / `Realizadas`

### Evento `Novo > Nova Coleta`

Campos do modal:
- `transformador`
- `statusUltimaColeta`
- `dataColeta`
- `subestacao`
- `unidade`
- `tag`
- `tipoAnalise`

Estado atual:
- salvo em memória em `manualColetas`

Regras atuais no front:
- toda nova coleta entra como categoria `proximas`
- status calculado:
  - `Atrasada` quando a data já passou
  - `Pendente` caso contrário

Integração recomendada:
- `GET /transformadores/:id/coletas`
- `POST /transformadores/:id/coletas`
- `GET /coletas`

Exportação:
- UI pronta
- download ainda não integrado

## 6.5 Tratamento de Óleo

Controles visíveis:
- busca
- `Ordenado por`
- `Filtro avançado`
- `Colunas`
- `Limpar Filtro`
- tabela de tratamentos
- modal de detalhes

### Evento `Detalhes`

Abre modal com detalhes do tratamento.

Estado atual:
- leitura de dados locais

### Evento `Novo Tratamento`

O modal existe no código, mas a UI principal foi simplificada ao longo das iterações.

Campos do modal:
- `statusTratamento`
- `dataColeta`
- `tipoAnalise`
- `rd`
- `teorAgua`
- `tensaoInterfacial`
- `indNeutralizacao`
- `fator25`
- `fator90`
- `fator100`
- `dbpc`

Estado atual:
- salvo em memória em `manualTreatmentRows`

Integração recomendada:
- `GET /transformadores/:id/tratamentos`
- `POST /transformadores/:id/tratamentos`
- `GET /tratamentos`

Exportação:
- `downloadTreatmentExports()` é placeholder

## 6.6 Geração de relatório

Controle disponível no relatório por transformador:
- `Gerar Relatório`

Seções selecionáveis:
- `Avaliação Completa`
- `Histórico de Análises`
- `Avaliações Complementares`
- `Coletas`
- `Tratamento de Óleo`
- `TR-Óleo`

Estado atual:
- seleção funciona
- download ainda não faz chamada real

Integração recomendada:
- `POST /transformadores/:id/relatorios/gerar`

Sugestão de payload:

```json
{
  "macro": "TR-Óleo",
  "sections": [
    "Avaliação Completa",
    "Histórico de Análises",
    "Avaliações Complementares"
  ]
}
```

## 7. Filtro avançado

Disponível em:
- lista de transformadores
- histórico de análises
- coletas
- tratamento de óleo

Operadores atuais no front:
- `==`
- `!=`
- `>`
- `<`
- `>=`
- `<=`

Combinadores:
- `E`
- `OU`

Estrutura lógica de uma regra:

```json
{
  "id": 1,
  "field": "status",
  "operator": "==",
  "value": "Normal",
  "joiner": "E"
}
```

Observação:
- hoje a aplicação filtra em memória
- backend deve aceitar múltiplas condições no mesmo request

## 8. Ordenação

Disponível em:
- lista de transformadores
- histórico de análises
- análise de campo do TR-Rota
- coletas
- tratamento de óleo

Padrão atual por módulo:
- transformadores: `status`, ordem de pior para melhor
- análises: `dataColeta desc`
- análise de campo: `dataColeta desc`
- coletas: campo de data da coleta, desc
- tratamento: campo de referência principal do tratamento

Recomendação:
- backend deve aceitar `sortField` e `sortDirection`
- colunas químicas devem ser tratadas como numéricas

## 9. Preferências do usuário

Hoje o frontend persiste apenas seleção de colunas em `localStorage`.

Chave-base:
- usa `axol.user.id`, `axol.user.email` ou `axol.user`

Uso:
- a coluna visível pode mudar por usuário e por contexto

Se o backend quiser centralizar isso:
- criar endpoint de preferências por usuário
- o front pode deixar de salvar localmente

## 10. Pontos ainda mockados ou locais

Hoje ainda estão sem API real:
- salvar análise de histórico (`saveAnalysisModal`)
- salvar análise de campo (`saveRouteAnalysisModal`)
- salvar coleta (`saveColetasModal`)
- salvar tratamento (`saveTreatmentCreateModal`)
- salvar observação do especialista (`saveSpecialistModal`)
- exportar análises
- exportar coletas
- exportar tratamentos
- gerar relatório consolidado
- item `Novo Transformador` na lista

## 11. Recomendação mínima de contrato backend

Se o objetivo for integrar por etapas, a ordem mais eficiente é:

1. leitura de dados
- `GET /transformadores`
- `GET /transformadores/:id`
- `GET /transformadores/:id/relatorio`

2. operações críticas do relatório
- `GET /transformadores/:id/analises`
- `POST /transformadores/:id/analises/...`
- `GET /transformadores/:id/coletas`
- `POST /transformadores/:id/coletas`
- `GET /transformadores/:id/tratamentos`
- `POST /transformadores/:id/tratamentos`

3. módulos auxiliares
- `PUT /transformadores/:id/especialista`
- `POST /transformadores/:id/relatorios/gerar`
- endpoints de exportação

## 12. Observações finais

- O frontend já está preparado para receber o contexto por rota e query string.
- O maior volume de integração está concentrado em `TransformerReportView.vue`.
- `TransformerReportView.vue` atende três cenários:
  - relatório por transformador
  - análises globais
  - coletas globais
  - tratamento global
- Vale manter o backend com filtros, paginação e ordenação server-side desde o início para evitar retrabalho.
