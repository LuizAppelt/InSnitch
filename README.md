# 🕵️ InSnitch — Instagram Follow, Unfollow & Mutuals Radar

Um aplicativo Web moderno com design idêntico ao **Instagram** para monitorar e analisar o histórico de **seguidores**, **quem deixou de te seguir (unfollows)**, **amigos mútuos**, **verificados VIP** e **fantasmas** de qualquer perfil público do Instagram, com relatórios gerados por Inteligência Artificial (**Google Gemini**).

---

## ✨ Funcionalidades Principais

* 🎨 **Interface Idêntica ao Instagram Web**:
  * Temas **Escuro** (`#000000`) e **Claro** com alternância instantânea.
  * Animação de Stories/Avatar em tempo real durante as varreduras.
  * Hub de métricas em 2 níveis harmônicos (Movimentações Recentes + Diagnóstico da Base).
* 👥 **Rastreamento de Diffs e Movimentações**:
  * 🟢 **Novos Seguidores**: Detecta quem começou a te seguir desde a última checagem.
  * 🔴 **Quem Deixou de Seguir (Unfollows Deles)**: Lista exata de quem parou de te seguir.
  * 🚶‍♂️ **Você Deixou de Seguir**: Registra contas que você removeu da sua lista de seguindo.
  * 🤝 **Amigos Mútuos**: Identifica conexões recíprocas (ambos se seguem).
  * ⚠️ **Não Te Seguem de Volta**: Lista quem você segue mas não é correspondido.
  * ⭐ **Seus Fãs**: Usuários que te seguem mas você não segue de volta.
  * 💎 **VIP / Selo Azul**: Filtra seguidores com selo oficial de verificação.
  * 👻 **Fantasmas / Sem Foto**: Auditoria de perfis inativos ou sem imagem de avatar.
* 🤖 **Análise Inteligente com Google Gemini**:
  * Diagnósticos de crescimento, retenção e dicas estratégicas em linguagem natural.
* 📈 **Gráficos Interativos (Chart.js)**:
  * Curva de evolução de seguidores ao longo do tempo através dos snapshots locais.
* 💾 **Histórico Seguro (SQLite)**:
  * Todos os dados são salvos localmente no seu computador com total privacidade.
* 🧩 **Extensão InSnitch (Chrome / Edge)**:
  * Sincronização em 1 clique direto da sua navegação no Instagram sem riscos de bloqueio.

---

## 🚀 Como Iniciar

1. Certifique-se de que o Python está instalado.
2. Abra o terminal nesta pasta e execute:
   ```bash
   python run.py
   ```
3. O painel abrirá automaticamente no seu navegador padrão em `http://localhost:8000`.

---

## 🧩 Extensão para Chrome / Edge (Sincronização 1-Clique com Zero Bloqueios)

Criamos uma extensão oficial para o seu navegador que aproveita a sua sessão diária ativa no Instagram:

1. Acesse `chrome://extensions` (ou `edge://extensions`) no seu navegador.
2. Ative a chave **"Modo do desenvolvedor"** no canto superior direito.
3. Clique em **"Carregar sem compactação"** (ou *Load unpacked*) e selecione a pasta:
   ```
   C:\Users\user\IdeaProjects\Follow\extension
   ```
4. Pronto! Ao abrir qualquer perfil no Instagram, clique no ícone da extensão para sincronizar com 1 clique para o seu Dashboard local!

---

## ⚙️ Configurações Opcionais

No painel, clique no menu **Configurações** (engrenagem no canto inferior esquerdo) para:
* Adicionar sua **Google Gemini API Key** (para gerar análises automáticas personalizadas).
* Inserir seu cookie `sessionid` do Instagram se desejar alternar para o **Modo Real**.
