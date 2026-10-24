"""Command line: `coach sync`, `coach analyze`, `coach summary`, `coach export`, `coach serve`."""

import time

import typer

from . import analysis, chesscom, config, db, engine, export, stats

app = typer.Typer(no_args_is_help=True, add_completion=False, help="Your personal chess coach.")


@app.command()
def sync(username: str = typer.Option(config.USERNAME, help="chess.com username")) -> None:
    """Download new games from chess.com."""
    with db.connect() as conn:
        added = chesscom.sync(conn, username)
        total = conn.execute("SELECT COUNT(*) FROM games").fetchone()[0]
    typer.echo(f"{added} new games ({total} total).")


@app.command()
def analyze(
    regrade: bool = typer.Option(False, "--regrade", help="Re-grade every game (engine results stay cached)."),
) -> None:
    """Run Stockfish on new games, then grade every move and tag mistakes."""
    started = time.monotonic()
    last_shown = [0.0]

    def progress(done: int, total: int) -> None:
        now = time.monotonic()
        if done == total or now - last_shown[0] > 2:
            last_shown[0] = now
            rate = done / max(now - started, 1e-6)
            eta = (total - done) / rate if rate else 0
            typer.echo(f"  Stockfish: {done}/{total} positions, ~{eta:.0f}s left")

    with db.connect() as conn:
        db.set_meta(conn, "engine_name", engine.engine_name())
        typer.echo(f"Analysing with {config.ENGINE_WORKERS} engines, {config.ENGINE_NODES:,} nodes per position.")
        positions, games = analysis.run(conn, regrade_all=regrade, progress=progress)
    typer.echo(f"Graded {games} games ({positions} new positions) in {time.monotonic() - started:.0f}s.")


@app.command()
def summary() -> None:
    """Print your top weaknesses."""
    with db.connect() as conn:
        data = stats.overview(conn)
    if data.get("empty"):
        typer.echo("No analysed games yet. Run `coach sync` then `coach analyze`.")
        return
    p = data["player"]
    typer.echo(f"{p['username']}: {p['games']} games, {p['win']}W {p['loss']}L {p['draw']}D, "
               f"rating {p['rating']} (peak {p['peak']}), accuracy {p['accuracy']:.1f}")
    typer.echo("\nBiggest weaknesses (by win % lost per game):")
    for w in data["weaknesses"][:5]:
        g = w["games"]
        typer.echo(f"  {w['title']:<34} {w['occurrences']:>3}x in {g['k']}/{g['n']} games "
                   f"({g['lo']:.0%}–{g['hi']:.0%}), avg -{w['avg_loss']:.0f}% win chance")
    v = data["validation"]
    if v["pearson"] is not None:
        typer.echo(f"\nAccuracy vs chess.com on {len(v['pairs'])} games: r = {v['pearson']:.2f}, "
                   f"mean difference {v['mean_abs_diff']:.1f} points")


@app.command("export")
def export_cmd() -> None:
    """Write the dashboard data as static JSON (web/public/data)."""
    with db.connect() as conn:
        count = export.run(conn)
    typer.echo(f"Exported {count} games to {config.EXPORT_DIR}")


@app.command()
def serve(port: int = 8000) -> None:
    """Serve the dashboard data from the live database."""
    import uvicorn

    uvicorn.run("coach.api:app", port=port, reload=False)
