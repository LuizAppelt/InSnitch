import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from src.database import init_db, save_profile, save_snapshot, get_snapshots_for_profile
from src.instagram_service import fetch_profile_data
from src.diff_engine import calculate_diff
from src.ai_reporter import generate_ai_report
from src.config import INSTAGRAM_SESSION_COOKIE

def main():
    init_db()

    print("=" * 65)
    print(" 🚀 VARREDURA 100% REAL DO PERFIL @luiz.appelt VIA INSTAGRAM API")
    print("=" * 65)

    data = fetch_profile_data('luiz.appelt', use_mock=False, session_id_cookie=INSTAGRAM_SESSION_COOKIE)

    print("\n✅ DADOS REAIS DO PERFIL:")
    print(f"  • Username: @{data['profile']['username']}")
    print(f"  • Nome: {data['profile']['full_name']}")
    print(f"  • Foto Avatar: {data['profile']['profile_pic_url'][:60]}...")
    print(f"  • Total Seguidores Coletados: {data['followers_count']}")
    print(f"  • Total Seguindo Coletados: {data['following_count']}")

    p_id = save_profile(data['profile'])
    snap_id = save_snapshot(
        p_id,
        data['followers_count'],
        data['following_count'],
        data['posts_count'],
        data['followers'],
        data['following'],
        note='Varredura Real'
    )

    diff = calculate_diff(snap_id, None)

    print("\n📊 MÉTRICAS DE RECIPROCIDADE REAIS:")
    print(f"  • Total Seguidores: {diff['counts']['total_followers']}")
    print(f"  • Total Seguindo: {diff['counts']['total_following']}")
    print(f"  • Contas que você segue mas NÃO te seguem de volta: {diff['counts']['not_following_back_count']}")
    print(f"  • Seus Fãs (te seguem mas você NÃO segue de volta): {diff['counts']['fans_count']}")
    print(f"  • Conexões Mútuas (vocês se seguem mutuamente): {diff['counts']['mutual_count']}")

    print("\n🚫 Exemplos de contas que você segue e NÃO te seguem de volta:")
    for u in diff['reciprocity']['not_following_back'][:10]:
        print(f"   - @{u['username']} ({u['full_name']})")

    print("\n⭐ Exemplos de Fãs (te seguem mas você não segue de volta):")
    for u in diff['reciprocity']['fans'][:10]:
        print(f"   - @{u['username']} ({u['full_name']})")

    print("\n" + "=" * 65)
    print(" ✅ VARREDURA REAL CONCLUÍDA E SALVA NO BANCO COM SUCESSO!")
    print("=" * 65)

if __name__ == "__main__":
    main()
