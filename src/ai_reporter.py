import os
from typing import Dict, Any, Optional
from src.config import GEMINI_API_KEY

def generate_ai_report(
    profile_data: Dict[str, Any],
    diff_data: Dict[str, Any],
    api_key: Optional[str] = None
) -> str:
    """
    Generates an executive, natural language intelligence report summarizing
    Instagram profile dynamics, follower retention, new audience, and reciprocity.
    Uses Google Gemini API when API key is available, or an algorithmic fallback.
    """
    key = api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    username = profile_data.get("username", "perfil")
    counts = diff_data.get("counts", {})
    is_baseline = diff_data.get("is_baseline", False)
    
    new_followers = [u["username"] for u in diff_data.get("diffs", {}).get("new_followers", [])]
    lost_followers = [u["username"] for u in diff_data.get("diffs", {}).get("lost_followers", [])]
    new_following = [u["username"] for u in diff_data.get("diffs", {}).get("new_following", [])]
    lost_following = [u["username"] for u in diff_data.get("diffs", {}).get("lost_following", [])]
    not_following_back = [u["username"] for u in diff_data.get("reciprocity", {}).get("not_following_back", [])]
    fans = [u["username"] for u in diff_data.get("reciprocity", {}).get("fans", [])]

    # If Gemini API key is available, generate with Google GenAI SDK
    if key and len(key.strip()) > 5:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=key)

            prompt = f"""
Analise os seguintes dados de monitoramento do perfil do Instagram @{username} e crie um relatório executivo, amigável e direto em Markdown no idioma Português (Brasil).

DADOS DO PERFIL:
- Nome: {profile_data.get("full_name", "")}
- Bio: {profile_data.get("biography", "")}
- É a primeira coleta (linha de base)?: {"Sim" if is_baseline else "Não"}
- Total de Seguidores: {counts.get("total_followers", 0)}
- Total de Perfis Seguidos: {counts.get("total_following", 0)}

MUDANÇAS RECENTES (ÚLTIMO INTERVALO):
- Novos Seguidores ({len(new_followers)}): {', '.join('@' + u for u in new_followers) if new_followers else 'Nenhum'}
- Deixaram de Seguir / Unfollows ({len(lost_followers)}): {', '.join('@' + u for u in lost_followers) if lost_followers else 'Nenhum'}
- Novos Perfis Seguidos ({len(new_following)}): {', '.join('@' + u for u in new_following) if new_following else 'Nenhum'}
- Deixou de Seguir ({len(lost_following)}): {', '.join('@' + u for u in lost_following) if lost_following else 'Nenhum'}

MÉTRICAS DE RECIPROCIDADE:
- Perfis que você segue mas não te seguem de volta ({len(not_following_back)}): {', '.join('@' + u for u in not_following_back[:10]) if not_following_back else 'Nenhum'}
- Fãs (te seguem mas você não segue de volta) ({len(fans)}): {', '.join('@' + u for u in fans[:10]) if fans else 'Nenhum'}

DIRETRIZES DE ESTILO:
1. Comece com um resumo rápido do momento atual do perfil.
2. Destaque o saldo líquido de crescimento (Novos - Perdidos).
3. Faça observações sobre a taxa de reciprocidade (se há muitas contas não correspondidas).
4. Dê 1 ou 2 dicas de engajamento baseadas nas movimentações observadas.
5. Use emojis do Instagram, formatação limpa com tópicos e negritos. Seja direto e elegante.
"""

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    system_instruction="Você é o especialista de inteligência e análise de métricas do Instagram da Antigravity. Você analisa dados de followers/following com extrema precisão e tom profissional e amigável."
                )
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            print(f"Gemini API generation error: {e}")
            # Fall back to algorithmic report below

    # Algorithmic fallback report
    if is_baseline:
        return f"""### 📊 Relatório Inicial de Linha de Base — @{username}

✨ **Primeiro Snapshot Registrado com Sucesso!**
* **Total de Seguidores:** {counts.get('total_followers', 0)}
* **Total Seguindo:** {counts.get('total_following', 0)}
* **Não te seguem de volta:** {counts.get('not_following_back_count', 0)} contas
* **Seus Fãs (seguidores fiéis):** {counts.get('fans_count', 0)} contas

> 💡 **Nota da IA:** Esta é a sua primeira varredura de referência. A partir do próximo escaneamento, o sistema identificará com precisão cada novo seguidor e quem deixou de seguir!"""

    net_growth = len(new_followers) - len(lost_followers)
    growth_symbol = "🟢 +" if net_growth >= 0 else "🔴 "

    new_str = ", ".join(f"**@{u}**" for u in new_followers[:5]) if new_followers else "Nenhum novo seguidor detectado"
    lost_str = ", ".join(f"**@{u}**" for u in lost_followers[:5]) if lost_followers else "Nenhum unfollow detectado"

    return f"""### ⚡ Relatório de Atividade Recente — @{username}

**Saldo de Crescimento:** {growth_symbol}{net_growth} seguidores no último intervalo.

#### 🔍 Movimentações Principais:
* **Novos Seguidores ({len(new_followers)}):** {new_str}
* **Deixaram de Seguir ({len(lost_followers)}):** {lost_str}
* **Perfis que você começou a seguir ({len(new_following)}):** {len(new_following)} novas contas
* **Contas que não te seguem de volta:** {counts.get('not_following_back_count', 0)} contas

> 💡 **Dica de Estratégia:** Verifique a lista de contas que não te seguem de volta na aba **Reciprocidade** para otimizar sua taxa de engajamento! *(Configure sua chave do Google Gemini nas Configurações para desbloquear análises comportamentais avançadas).*"""
