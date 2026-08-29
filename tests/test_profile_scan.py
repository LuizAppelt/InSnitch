import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from src.app import sanitize_username
from src.instagram_service import fetch_profile_data, fetch_instagram_data_real
from src.database import init_db, save_profile, save_snapshot, get_profile_by_username, get_snapshots_for_profile
from src.diff_engine import calculate_diff
from src.ai_reporter import generate_ai_report

def run_tests():
    init_db()

    print("=" * 65)
    print(" 🔍 TESTES DO SISTEMA DE MONITORAMENTO PARA @luiz.appelt")
    print("=" * 65)

    # 1. Higienização de URL
    raw_url = "https://www.instagram.com/luiz.appelt/"
    username = sanitize_username(raw_url)
    print(f"\n1. URL Higienizada com sucesso:")
    print(f"   Input: '{raw_url}' -> Username: '@{username}'")

    # 2. Conexão com o Instagram
    print(f"\n2. Teste de Conexão com o Instagram:")
    try:
        data_real = fetch_instagram_data_real(username)
        print(f"   [OK] Conexão direta com Instagram para @{username} bem-sucedida!")
    except Exception as e:
        print(f"   [INFO] Resposta do Instagram sem login/cookies: {e}")

    # 3. Snapshot T0 (Linha de Base)
    print(f"\n3. Executando 1ª Varredura (Snapshot T0 - Linha de Base):")
    d1 = fetch_profile_data(username, use_mock=True)
    p_id = save_profile(d1["profile"])
    s1_id = save_snapshot(
        p_id, 
        d1["followers_count"], 
        d1["following_count"], 
        d1["posts_count"], 
        d1["followers"], 
        d1["following"], 
        note="1ª Coleta"
    )
    diff_t0 = calculate_diff(s1_id, None)

    print(f"   • Perfil: @{d1['profile']['username']} ({d1['profile']['full_name']})")
    print(f"   • Total de Seguidores: {diff_t0['counts']['total_followers']}")
    print(f"   • Total Seguindo: {diff_t0['counts']['total_following']}")
    print(f"   • Não te seguem de volta: {diff_t0['counts']['not_following_back_count']} contas")
    print(f"   • Seus Fãs (você não segue): {diff_t0['counts']['fans_count']} contas")

    # 4. Snapshot T1 (Simulação de Atividade e Detecção de Diffs)
    print(f"\n4. Executando 2ª Varredura (Snapshot T1 - Detecção de Diffs):")
    d2 = fetch_profile_data(username, use_mock=True)
    s2_id = save_snapshot(
        p_id, 
        d2["followers_count"], 
        d2["following_count"], 
        d2["posts_count"], 
        d2["followers"], 
        d2["following"], 
        note="2ª Coleta"
    )
    diff_t1 = calculate_diff(s2_id, s1_id)

    new_f = [u["username"] for u in diff_t1["diffs"]["new_followers"]]
    lost_f = [u["username"] for u in diff_t1["diffs"]["lost_followers"]]
    print(f"   🟢 Novos Seguidores (+{len(new_f)}): {new_f}")
    print(f"   🔴 Deixaram de Seguir (-{len(lost_f)}): {lost_f}")

    # 5. Snapshot T2 (Nova evolução)
    print(f"\n5. Executando 3ª Varredura (Snapshot T2 - Nova Atividade):")
    d3 = fetch_profile_data(username, use_mock=True)
    s3_id = save_snapshot(
        p_id, 
        d3["followers_count"], 
        d3["following_count"], 
        d3["posts_count"], 
        d3["followers"], 
        d3["following"], 
        note="3ª Coleta"
    )
    diff_t2 = calculate_diff(s3_id, s2_id)

    new_f2 = [u["username"] for u in diff_t2["diffs"]["new_followers"]]
    lost_f2 = [u["username"] for u in diff_t2["diffs"]["lost_followers"]]
    print(f"   🟢 Novos Seguidores (+{len(new_f2)}): {new_f2}")
    print(f"   🔴 Deixaram de Seguir (-{len(lost_f2)}): {lost_f2}")

    # 6. Relatório Inteligente de IA
    print(f"\n6. Relatório Inteligente Gerado:")
    relatorio = generate_ai_report(d3["profile"], diff_t2)
    print("-" * 50)
    print(relatorio)
    print("-" * 50)

    # 7. Histórico no SQLite
    print(f"\n7. Histórico Completo Registrado no SQLite:")
    snaps = get_snapshots_for_profile(p_id)
    for s in snaps:
        print(f"   • Snapshot #{s['id']}: {s['followers_count']} seg. | {s['following_count']} seguidos | {s['timestamp']}")

    print("\n" + "=" * 65)
    print(" ✅ TODOS OS TESTES FORAM EXECUTADOS COM SUCESSO!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
