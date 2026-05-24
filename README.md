# Tagly

Organizador inteligente de capturas e gravações de tela para Android — agrupa mídias por aplicativo, gera tags automáticas com IA, permite busca instantânea por conteúdo e remove arquivos antigos automaticamente com regras de retenção configuráveis por pasta.

<br>

<div align="center">
  <p>
    <img src="https://img.shields.io/badge/plataforma-Tasker%20%2F%20Android-blueviolet?style=flat-square" />
    <img src="https://img.shields.io/badge/linguagem-JavaScript%20%7C%20Shell-f7df1e?style=flat-square" />
    <img src="https://img.shields.io/badge/IA-Gemini%20API-4285f4?style=flat-square" />
    <img src="https://img.shields.io/badge/i18n-pt%20%7C%20en%20%7C%20es-blue?style=flat-square" />
    <img src="https://img.shields.io/badge/licença-MIT-green?style=flat-square" />
  </p>
</div>

---

## Demonstração

<div align="center">
  <img src=".github/assets/preview.jpg" alt="Prévia do Tagly" width="320" style="border-radius: 10px">
</div>

---

## Funcionalidades

### Dashboard

Painel central com métricas em tempo real: arquivos organizados, removidos e pendentes. Exibe o app com mais mídias organizadas e oferece **Ações Rápidas** para as operações mais comuns:

- **Organizar Capturas** — move capturas de tela para pastas por aplicativo
- **Organizar Gravações** — move gravações de tela para pastas por aplicativo
- **Executar Limpeza** — remove arquivos que ultrapassaram o prazo configurado
- **Gerar Tags** — abre o dialog de geração de tags com IA

Também exibe os **Gatilhos de Automação** com status em tempo real (ativo/inativo):
- **Execução Agendada** — organiza e limpa arquivos automaticamente todos os dias às 01:00
- **Carimbo de Gravação** — detecta gravações de tela e adiciona o nome do app capturado ao arquivo

---

### Organização de Mídias

Grade de pastas agrupadas por aplicativo de origem. Filtros por tipo (todas, capturas ou gravações) e toggle de **Organização Automática** que monitora em segundo plano e organiza novas mídias sem intervenção manual.

Ao entrar em uma pasta, as mídias são exibidas com seu status de tag visível em cada card. Uma barra de filtros clicável permite ver apenas:

- **Todas** — todas as mídias da pasta
- **Com tags** — mídias já tagueadas pela IA
- **Pendentes** — mídias que ainda não foram analisadas
- **Ignoradas** — mídias marcadas para pular

Ao tocar em uma mídia, abre o **Detalhe** com preview em tela cheia (ou player de vídeo para gravações), exibição das tags aplicadas com opção de removê-las individualmente, e botão para gerar tags caso o arquivo ainda não tenha nenhuma.

---

### Geração de Tags com IA

Usa a **Gemini API** para analisar visualmente cada captura ou gravação e gerar palavras-chave descritivas automaticamente. As tags são **embutidas no próprio nome do arquivo**, sem banco de dados externo:

```
screenshot[instagram_stories_feed].jpg
screen-recording[whatsapp_videochamada].mp4
screenshot[skip].jpg   ← ignorado manualmente
```

O dialog de tagging exibe uma fila de mídias pendentes, uma por vez, com contadores de progresso (pendentes / com tags / ignoradas). As ações disponíveis são:

| Ação | Comportamento |
|---|---|
| **Gerar Tags** | Envia a imagem ao Gemini e aplica as tags retornadas ao nome do arquivo |
| **Ignorar** | Marca o arquivo como `[skip]` sem gerar tags |
| **Gerar Tags em Todas** | Processa toda a fila com **3 workers paralelos** e prefetch de 10 itens à frente |
| **Ignorar Todas** | Marca todos os arquivos pendentes como `[skip]` em lote |
| **Parar** | Interrompe o lote e retorna ao ponto onde parou |

**Fallback automático:** ao atingir cota ou rate limit em uma chave ou modelo, o sistema rotaciona automaticamente entre as múltiplas chaves e modelos configurados, sem interromper o fluxo. As tags são geradas **no idioma configurado no app** (pt, en ou es).

---

### Busca por Tags e Pastas

Campo de busca com debounce de 300ms disponível na aba Organização. A busca funciona em dois contextos:

- **Visão de pastas** — pesquisa simultaneamente por nome de app e por tags em todas as mídias organizadas, retornando resultados separados em seções de Pastas e Arquivos
- **Dentro de uma pasta** — filtra instantaneamente as mídias da pasta pelo conteúdo das tags no nome do arquivo

---

### Limpeza Automática

Configurável **por pasta e por tipo de mídia individualmente**. Para cada pasta organizada é possível definir:

- Habilitar ou não a limpeza automática de capturas de tela da pasta
- Habilitar ou não a limpeza automática de gravações de tela da pasta
- **Prazo de retenção em dias separado** para cada tipo — por exemplo, apagar capturas após 30 dias e gravações após 7 dias na mesma pasta

A limpeza pode ser executada manualmente pelas Ações Rápidas do Dashboard ou automaticamente pelo Tasker conforme o agendamento configurado.

---

### Estatísticas

Gráficos semanais de atividade com alternância entre capturas e gravações, ranking das pastas com mais arquivos organizados e feed de atividades recentes com histórico completo de operações.

---

### Configurações

- **Tema** — claro, escuro ou automático (segue o sistema)
- **Idioma** — Português (BR), Inglês e Espanhol; as tags geradas pela IA seguem este idioma
- **Notificações** — resultado de organização, limpeza e aviso de arquivos pendentes
- **Pasta de destino** — caminho personalizado para os arquivos organizados
- **Gemini AI** — gerenciamento de múltiplas chaves de API e seleção do modelo preferido
- **Exportar / Importar dados** — backup e restauração completa em JSON
- **Restaurar configurações** — reverte preferências para os padrões sem apagar dados
- **Apagar todos os dados** — remove configurações e histórico (arquivos de mídia não são afetados)

#### Configuração do Gemini AI

Adicione quantas chaves de API quiser. O sistema rotaciona automaticamente entre elas quando uma atingir o limite de cota. Escolha o modelo preferido entre as opções disponíveis — se o modelo escolhido estiver indisponível, o fallback assume automaticamente na ordem:

```
gemini-2.5-flash-lite → gemini-3-flash-preview → gemini-2.5-flash → gemini-3-pro-preview → gemini-2.5-pro
```

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| Vanilla JavaScript (ES6+) | Toda a lógica de UI e negócio, sem frameworks |
| CSS Custom Properties | Theming e suporte a dark/light mode |
| Chart.js | Gráficos de atividade semanal |
| Gemini API (Google) | Análise visual e geração de tags com IA |
| POSIX Shell | Operações no sistema de arquivos Android |
| Tasker API | Integração com automações do Android |

---

## Pré-requisitos

- Android com **[Tasker](https://tasker.joaoapps.com/)** instalado e com permissão de armazenamento
- **Chave de API do Gemini** para usar a geração de tags — obtenha gratuitamente em [aistudio.google.com](https://aistudio.google.com/)
- Desenvolvimento local: qualquer navegador moderno com suporte a ES6+

---

## Instalação

### Produção (via Tasker)

1. Baixe o arquivo XML da [última release](../../releases/latest)
2. Importe o XML no Tasker e conceda as permissões de armazenamento
3. Execute a tarefa **Tagly** para abrir a interface
4. Vá em **Configurações → Gemini AI** e adicione sua chave de API

### Desenvolvimento local

```bash
git clone https://github.com/seu-usuario/tagly.git
cd tagly
# Abra index.html em qualquer navegador — sem bundler, sem dependências
```

No modo Web, dados são salvos no `localStorage` e operações de arquivo são simuladas com dados de exemplo. A geração de tags via Gemini funciona normalmente com uma chave válida.

---

## Fluxo Principal

```
1. Organizar
   Dashboard → "Organizar Capturas" ou "Organizar Gravações"
   → arquivos movidos para pastas por app

2. Gerar Tags
   Dashboard → "Gerar Tags"  (ou Organização → botão ✦)
   → Gemini analisa cada mídia e aplica tags no nome do arquivo

3. Buscar
   Organização → campo de busca → digitar uma tag ou nome de app
   → resultados em pastas + arquivos individuais
```

---

## Contribuição

1. Fork o repositório e crie uma branch: `git checkout -b feat/minha-feature`
2. Commit seguindo [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m 'feat: descrição'`
3. Abra um Pull Request

> Ao criar uma tag `v*`, o GitHub Actions gera automaticamente o changelog via Gemini API e publica a release com o XML do projeto Tasker.

---

## Licença

Distribuído sob a licença **MIT**. Veja [`LICENSE`](./LICENSE) para mais detalhes.
