# 📸 Instagram Follow Tracker & AI Intelligence

Um aplicativo Web moderno com design idêntico ao **Instagram** para monitorar e analisar o histórico de **seguidores**, **unfollows** e **reciprocidade** de qualquer perfil público do Instagram, com relatórios gerados por Inteligência Artificial (**Google Gemini**).

---

## ✨ Funcionalidades Principais

* 🎨 **Interface Idêntica ao Instagram Web**:
  * Temas **Escuro** (`#000000`) e **Claro** com alternância instantânea.
  * Animação nos Stories/Avatar em tempo real durante as varreduras.
  * Design limpo com fontes do Instagram, ícones Lucide e cartões de métricas.
* 👥 **Rastreamento de Diffs e Mudanças**:
  * 🟢 **Novos Seguidores**: Detecta quem começou a seguir o perfil desde a última checagem.
  * 🔴 **Quem Deixou de Seguir (Unfollow)**: Lista exata de quem saiu da lista de seguidores.
  * ⚠️ **Não Te Seguem de Volta**: Identifica quem você segue mas não é recíproco.
  * ⭐ **Fãs**: Usuários que te seguem mas você não segue de volta.
* 🤖 **Análise Inteligente com Google Gemini**:
  * Diagnósticos de crescimento, retenção e dicas estratégicas em linguagem natural.
* 📈 **Gráficos Interativos (Chart.js)**:
  * Curva de evolução de seguidores ao longo do tempo através dos snapshots locais.
* 💾 **Histórico Seguro (SQLite)**:
  * Todos os dados são salvos localmente no seu computador sem necessidade de configurar servidores de banco de dados.
* 🧪 **Modo Simulação / Demonstração Integrado**:
  * Permite testar imediatamente novos seguidores e unfollows com perfis realistas sem risco de bloqueio.

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
