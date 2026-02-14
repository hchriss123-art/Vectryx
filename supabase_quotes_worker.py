import os
import time
from datetime import datetime, timezone

import requests
import yfinance as yf
from supabase import create_client, Client


# -------------------------------------------------------
# ENV
# -------------------------------------------------------

def get_env(name: str) -> str:
    v = os.getenv(name, "").strip()
    if not v:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return v


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_tickers(text: str) -> list[str]:
    """
    Accepts comma/space/newline separated tickers, returns unique uppercase list.
    Example: "AAPL, msft tsla\nNVDA" -> ["AAPL","MSFT","TSLA","NVDA"]
    """
    if not text:
        return []
    raw = (
        text.replace("\n", " ")
            .replace("\t", " ")
            .replace(";", ",")
            .replace("|", ",")
    )
    parts = []
    for chunk in raw.split(","):
        parts.extend(chunk.split(" "))

    out = []
    seen = set()
    for p in parts:
        tk = p.strip().upper()
        if not tk:
            continue
        # Basic cleanup for common user input issues
        tk = tk.replace("$", "").replace('"', "").replace("'", "")
        if tk and tk not in seen:
            seen.add(tk)
            out.append(tk)
    return out


# -------------------------------------------------------
# TWELVE DATA QUOTES
# -------------------------------------------------------

def fetch_twelvedata_quotes(tickers: list[str]) -> dict[str, dict]:
    """
    Returns:
      { "AAPL": {"price": 275.93, "change_pct": -0.20}, ... }
    """
    key = os.getenv("TWELVE_DATA_KEY", "").strip()
    if not key:
        return {}

    symbols = ",".join([t.upper().strip() for t in tickers if t.strip()])
    if not symbols:
        return {}

    url = "https://api.twelvedata.com/quote"
    params = {"symbol": symbols, "apikey": key}

    try:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        print("[twelvedata] sample:", str(data)[:180])
    except Exception as e:
        print(f"[twelvedata] ERROR: {e}")
        return {}

    out: dict[str, dict] = {}

    # Single symbol response
    if isinstance(data, dict) and "symbol" in data:
        sym = str(data.get("symbol", "")).upper()
        # Prefer 'price' if present. Fallbacks just in case.
        price = data.get("price") or data.get("close") or data.get("previous_close")
        pct = data.get("percent_change")

        if sym:
            out[sym] = {
                "price": float(price) if price not in (None, "") else None,
                "change_pct": float(pct) if pct not in (None, "") else None,
            }
        return out

    # Multi-symbol response
    if isinstance(data, dict):
        for sym, payload in data.items():
            if not isinstance(payload, dict):
                continue

            sym_u = str(sym).upper()
            # Prefer 'price'
            price = payload.get("price") or payload.get("close") or payload.get("previous_close")
            pct = payload.get("percent_change")

            if price is None and pct is None:
                continue

            out[sym_u] = {
                "price": float(price) if price not in (None, "") else None,
                "change_pct": float(pct) if pct not in (None, "") else None,
            }

    return out


# -------------------------------------------------------
# YFINANCE FALLBACK
# -------------------------------------------------------

def fetch_yfinance_quotes(tickers: list[str]) -> dict[str, dict]:
    """
    Returns:
      { "AAPL": {"price": 275.93, "change_pct": -0.20}, ... }
    Uses a 1d period with 1m interval to approximate last price and pct move.
    """
    tickers = [t.upper().strip() for t in tickers if t.strip()]
    if not tickers:
        return {}

    out: dict[str, dict] = {}

    # yfinance can fetch multiple tickers at once
    try:
        data = yf.download(
            tickers=" ".join(tickers),
            period="1d",
            interval="1m",
            group_by="ticker",
            auto_adjust=False,
            threads=True,
            progress=False,
        )
    except Exception as e:
        print(f"[yfinance] ERROR: {e}")
        return {}

    # yfinance returns different shapes for single vs multi
    def compute_from_df(df):
        try:
            if df is None or df.empty:
                return None, None
            last_close = float(df["Close"].dropna().iloc[-1])
            first_close = float(df["Close"].dropna().iloc[0])
            if first_close == 0:
                pct = None
            else:
                pct = ((last_close - first_close) / first_close) * 100.0
            return last_close, pct
        except Exception:
            return None, None

    if isinstance(data.columns, type(getattr(data, "columns", None))) and hasattr(data.columns, "levels"):
        # Multi-ticker: column MultiIndex
        for tk in tickers:
            if tk in data.columns.get_level_values(0):
                df = data[tk]
                price, pct = compute_from_df(df)
                if price is not None or pct is not None:
                    out[tk] = {"price": price, "change_pct": pct}
    else:
        # Single ticker dataframe
        price, pct = compute_from_df(data)
        if tickers:
            tk = tickers[0]
            if price is not None or pct is not None:
                out[tk] = {"price": price, "change_pct": pct}

    return out


# -------------------------------------------------------
# SIGNAL DERIVATION
# -------------------------------------------------------

def build_signal_row(user_id: str, ticker: str, price, change_pct) -> dict:
    cp = float(change_pct) if change_pct is not None else 0.0

    if cp >= 0.25:
        direction = "bullish"
        headline = "Bullish Momentum"
    elif cp <= -0.25:
        direction = "bearish"
        headline = "Bearish Pressure"
    else:
        direction = "neutral"
        headline = "Neutral Setup"

    magnitude = abs(cp)
    confidence = int(max(55, min(95, round(55 + magnitude * 20))))

    thesis = (
        f"{ticker} moved {cp:+.2f}% to ${price:.2f}."
        if price is not None
        else f"{ticker} moved {cp:+.2f}%."
    )

    return {
        "user_id": user_id,
        "ticker": ticker,
        "direction": direction,
        "confidence": confidence,
        "headline": headline,
        "thesis": thesis,
        "model_version": "rules-momentum-v1",
        "as_of": utc_now_iso(),
    }


# -------------------------------------------------------
# TICKERS SOURCE OF TRUTH: user_preferences.watchlist_text
# -------------------------------------------------------

def fetch_users_with_watchlists(supabase: Client) -> list[dict]:
    """
    Returns rows like: { user_id, watchlist_text }
    Assumes user_preferences has columns: user_id, watchlist_text
    """
    resp = (
        supabase.table("user_preferences")
        .select("user_id,watchlist_text")
        .execute()
    )
    return resp.data or []


# -------------------------------------------------------
# UPSERT QUOTES
# -------------------------------------------------------

def upsert_quotes_for_user(supabase: Client, user_id: str, tickers: list[str]) -> None:
    now = utc_now_iso()

    tickers = [t.upper().strip() for t in tickers if t.strip()]
    if not tickers:
        return

    quotes = {}
    source = "twelvedata"

    # TwelveData first
    try:
        quotes = fetch_twelvedata_quotes(tickers) or {}
    except Exception as e:
        print(f"[quotes] TwelveData exception: {e}")
        quotes = {}

    # Fallback
    if not quotes:
        source = "yfinance"
        try:
            quotes = fetch_yfinance_quotes(tickers) or {}
        except Exception as e:
            print(f"[quotes] yfinance exception: {e}")
            quotes = {}

    rows = []
    for sym in tickers:
        q = quotes.get(sym) or {}
        price = q.get("price")
        change_pct = q.get("change_pct")

        # never overwrite DB with nulls
        if price is None and change_pct is None:
            continue

        rows.append({
            "user_id": user_id,
            "ticker": sym,
            "price": float(price) if price is not None else None,
            "change": None,
            "change_pct": float(change_pct) if change_pct is not None else None,
            "updated_at": now,
            "source": source,
        })

    if not rows:
        print(f"[quotes] user={user_id} no valid quote rows (source={source})")
        return

    supabase.table("watchlist_quote").upsert(rows, on_conflict="user_id,ticker").execute()

    signal_rows = [
        build_signal_row(r["user_id"], r["ticker"], r.get("price"), r.get("change_pct"))
        for r in rows
    ]
    supabase.table("signal").upsert(signal_rows, on_conflict="user_id,ticker").execute()

    print(f"[quotes] user={user_id} upserted {len(rows)} quotes (source={source})")


# -------------------------------------------------------
# MAIN LOOP
# -------------------------------------------------------

def run_once(supabase: Client) -> None:
    rows = fetch_users_with_watchlists(supabase)
    print(f"[quotes] found {len(rows)} users with preferences")

    for r in rows:
        user_id = str(r.get("user_id") or "").strip()
        watchlist_text = str(r.get("watchlist_text") or "")

        if not user_id:
            continue

        tickers = normalize_tickers(watchlist_text)
        print(f"[quotes] user={user_id} tickers={len(tickers)}")

        if tickers:
            upsert_quotes_for_user(supabase, user_id, tickers)


def main():
    url = get_env("SUPABASE_URL")
    key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)

    poll_seconds = int(os.getenv("QUOTE_POLL_SECONDS", "60"))
    print(f"[quotes] starting worker poll={poll_seconds}s")

    while True:
        try:
            run_once(supabase)
            print("[quotes] done\n")
        except Exception as e:
            print(f"[quotes] ERROR: {e}\n")

        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
