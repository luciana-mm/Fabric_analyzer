"""
backend/db.py

Módulo centralizado de persistência no PostgreSQL para o backend e visão computacional.
Substitui o armazenamento de estados em arquivos JSON locais por tabelas dedicadas
no PostgreSQL (ex: system_runtime_settings e camera_devices).
"""

import json
import logging
import os
from typing import Any, Optional
from urllib.parse import urlparse

import psycopg
from psycopg.rows import dict_row

_log = logging.getLogger("backend.db")

# Cache em memória para resiliência caso o banco esteja reiniciando ou indisponível
_memory_cache: dict[str, Any] = {}


def get_database_url() -> str:
    """Resolve a URL de conexão com o PostgreSQL a partir do ambiente."""
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    user = os.getenv("POSTGRES_USER", "app_user")
    password = os.getenv("POSTGRES_PASSWORD", "app_password")
    host = os.getenv("DB_HOST", "db")
    port = os.getenv("DB_PORT", "5432")
    dbname = os.getenv("POSTGRES_DB", "fabric_analyzer")

    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"


def get_db_connection(timeout: float = 3.0) -> Optional[psycopg.Connection]:
    """
    Abre uma conexão com o PostgreSQL com timeout curto para não bloquear o streaming.
    Retorna None se o banco estiver indisponível.
    """
    url = get_database_url()
    try:
        conn = psycopg.connect(
            url,
            connect_timeout=int(timeout),
            autocommit=True,
            row_factory=dict_row,
        )
        return conn
    except Exception as exc:
        _log.warning("Falha ao conectar no PostgreSQL (%s): %s", url.split("@")[-1], exc)
        return None


def ensure_runtime_table_exists(conn: psycopg.Connection) -> None:
    """Garante que a tabela system_runtime_settings exista no schema public."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS public.system_runtime_settings (
                    key VARCHAR(100) PRIMARY KEY,
                    value JSONB NOT NULL,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_system_runtime_settings_key 
                    ON public.system_runtime_settings(key);
                """
            )
    except Exception as exc:
        _log.warning("Não foi possível provisionar automaticamente system_runtime_settings: %s", exc)


def get_runtime_setting(key: str, default: Any = None) -> Any:
    """
    Recupera uma configuração de runtime da tabela `system_runtime_settings`.
    Em caso de falha de conexão, consulta o cache em memória.
    """
    conn = get_db_connection()
    if conn is not None:
        try:
            ensure_runtime_table_exists(conn)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT value FROM public.system_runtime_settings WHERE key = %s LIMIT 1;",
                    (key,),
                )
                row = cur.fetchone()
                if row and "value" in row:
                    val = row["value"]
                    _memory_cache[key] = val
                    return val
        except Exception as exc:
            _log.warning("Erro ao consultar system_runtime_settings['%s']: %s", key, exc)
        finally:
            conn.close()

    # Fallback para o cache em memória
    return _memory_cache.get(key, default)


def set_runtime_setting(key: str, value: Any) -> bool:
    """
    Salva ou atualiza uma configuração de runtime na tabela `system_runtime_settings`.
    Atualiza também o cache em memória.
    """
    _memory_cache[key] = value

    conn = get_db_connection()
    if conn is not None:
        try:
            ensure_runtime_table_exists(conn)
            json_str = json.dumps(value, ensure_ascii=False)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.system_runtime_settings (key, value, updated_at)
                    VALUES (%s, %s::jsonb, CURRENT_TIMESTAMP)
                    ON CONFLICT (key) DO UPDATE
                    SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
                    """,
                    (key, json_str),
                )
            _log.info("Configuração '%s' persistida no PostgreSQL com sucesso", key)
            return True
        except Exception as exc:
            _log.error("Erro ao salvar system_runtime_settings['%s']: %s", key, exc)
        finally:
            conn.close()

    return False


def set_operator_active_camera(
    camera_id: str,
    camera_name: str,
    brand: str,
    stream_url: str,
    channel: str,
) -> bool:
    """
    Persiste a câmera ativa do operário no PostgreSQL tanto no registro
    `system_runtime_settings` quanto marcando `is_operator_default = true`
    na tabela `camera_devices` (se `camera_id` for fornecido).
    """
    payload = {
        "camera_id": camera_id,
        "camera_name": camera_name,
        "brand": brand,
        "stream_url": stream_url,
        "channel": channel,
    }
    saved_runtime = set_runtime_setting("active_operator_camera", payload)

    conn = get_db_connection()
    if conn is not None:
        try:
            with conn.cursor() as cur:
                if camera_id and len(camera_id) >= 32:
                    # Desmarca as outras e marca a selecionada
                    cur.execute("UPDATE public.camera_devices SET is_operator_default = false;")
                    cur.execute(
                        "UPDATE public.camera_devices SET is_operator_default = true WHERE id = %s::uuid;",
                        (camera_id,),
                    )
        except Exception as exc:
            _log.warning("Não foi possível atualizar is_operator_default na tabela camera_devices: %s", exc)
        finally:
            conn.close()

    return saved_runtime
