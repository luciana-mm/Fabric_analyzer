"""
backend/db.py

Módulo centralizado de persistência no PostgreSQL para o backend e visão computacional.
Substitui o armazenamento de estados em arquivos JSON locais por tabelas dedicadas
no PostgreSQL (ex: system_runtime_settings, camera_devices e dvr_devices),
garantindo transações atômicas e proteção contra condições de corrida (race conditions).
"""

import json
import logging
import os
import threading
import uuid
from typing import Any, Optional

import psycopg
from psycopg.rows import dict_row

_log = logging.getLogger("backend.db")

# Locks para sincronização thread-safe em memória e inicialização única de DDL
_cache_lock = threading.Lock()
_schema_lock = threading.Lock()
_schema_initialized = False

# Cache em memória para resiliência caso o banco esteja reiniciando ou indisponível
_memory_cache: dict[str, Any] = {}


def _is_valid_uuid(value: str) -> bool:
    """Verifica se uma string é um UUID válido."""
    if not value:
        return False
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


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


def get_db_connection(timeout: float = 3.0, autocommit: bool = True) -> Optional[psycopg.Connection]:
    """
    Abre uma conexão com o PostgreSQL com timeout curto para não bloquear o streaming.
    Retorna None se o banco estiver indisponível.
    """
    url = get_database_url()
    try:
        row_fact: Any = dict_row
        conn: Any = psycopg.connect(
            url,
            connect_timeout=int(timeout),
            autocommit=autocommit,
            row_factory=row_fact,
        )
        return conn
    except Exception as exc:
        _log.warning("Falha ao conectar no PostgreSQL (%s): %s", url.split("@")[-1], exc)
        return None


def ensure_runtime_table_exists(conn: Optional[psycopg.Connection] = None) -> None:
    """
    Garante uma única vez por processo que a tabela system_runtime_settings exista,
    evitando contenção de locks de catálogo (DDL) em chamadas concorrentes.
    """
    global _schema_initialized
    if _schema_initialized:
        return

    with _schema_lock:
        if _schema_initialized:
            return

        own_conn = False
        if conn is None:
            conn = get_db_connection()
            own_conn = True

        if conn is None:
            return

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
            _schema_initialized = True
        except Exception as exc:
            _log.warning("Não foi possível provisionar automaticamente system_runtime_settings: %s", exc)
        finally:
            if own_conn:
                conn.close()


def get_runtime_setting(key: str, default: Any = None) -> Any:
    """
    Recupera uma configuração de runtime da tabela `system_runtime_settings`.
    Em caso de falha de conexão, consulta o cache em memória de forma thread-safe.
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
                row: Any = cur.fetchone()
                if row and "value" in row:
                    val = row["value"]
                    with _cache_lock:
                        _memory_cache[key] = val
                    return val
        except Exception as exc:
            _log.warning("Erro ao consultar system_runtime_settings['%s']: %s", key, exc)
        finally:
            conn.close()

    with _cache_lock:
        return _memory_cache.get(key, default)


def set_runtime_setting(key: str, value: Any, merge: bool = False) -> bool:
    """
    Salva ou atualiza uma configuração de runtime na tabela `system_runtime_settings`.
    Se `merge=True` e o valor for um dicionário, realiza o merge atômico (`||`) no JSONB
    diretamente no PostgreSQL para evitar Lost Updates em gravações concorrentes.
    """
    with _cache_lock:
        if merge and isinstance(value, dict) and isinstance(_memory_cache.get(key), dict):
            merged = dict(_memory_cache[key])
            merged.update(value)
            _memory_cache[key] = merged
        else:
            _memory_cache[key] = value

    conn = get_db_connection()
    if conn is not None:
        try:
            ensure_runtime_table_exists(conn)
            json_str = json.dumps(value, ensure_ascii=False)
            with conn.cursor() as cur:
                if merge and isinstance(value, dict):
                    cur.execute(
                        """
                        INSERT INTO public.system_runtime_settings (key, value, updated_at)
                        VALUES (%s, %s::jsonb, CURRENT_TIMESTAMP)
                        ON CONFLICT (key) DO UPDATE
                        SET value = CASE
                                WHEN jsonb_typeof(public.system_runtime_settings.value) = 'object'
                                THEN public.system_runtime_settings.value || EXCLUDED.value
                                ELSE EXCLUDED.value
                            END,
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING value;
                        """,
                        (key, json_str),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO public.system_runtime_settings (key, value, updated_at)
                        VALUES (%s, %s::jsonb, CURRENT_TIMESTAMP)
                        ON CONFLICT (key) DO UPDATE
                        SET value = EXCLUDED.value,
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING value;
                        """,
                        (key, json_str),
                    )
                row: Any = cur.fetchone()
                if row and "value" in row:
                    with _cache_lock:
                        _memory_cache[key] = row["value"]
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
    Persiste a câmera ativa do operário no PostgreSQL em uma ÚNICA transação atômica,
    atualizando simultaneamente `system_runtime_settings` e `camera_devices.is_operator_default`.
    Elimina condições de corrida onde duas câmeras ficavam como default ao mesmo tempo.
    """
    payload = {
        "camera_id": camera_id,
        "camera_name": camera_name,
        "brand": brand,
        "stream_url": stream_url,
        "channel": channel,
    }

    with _cache_lock:
        _memory_cache["active_operator_camera"] = payload

    conn = get_db_connection()
    if conn is None:
        return False

    try:
        ensure_runtime_table_exists(conn)
        json_str = json.dumps(payload, ensure_ascii=False)
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.system_runtime_settings (key, value, updated_at)
                    VALUES ('active_operator_camera', %s::jsonb, CURRENT_TIMESTAMP)
                    ON CONFLICT (key) DO UPDATE
                    SET value = EXCLUDED.value,
                        updated_at = CURRENT_TIMESTAMP;
                    """,
                    (json_str,),
                )
                if _is_valid_uuid(camera_id):
                    # UPDATE único e atômico: desmarca a anterior e marca a nova na mesma instrução
                    cur.execute(
                        """
                        UPDATE public.camera_devices
                           SET is_operator_default = (id = %s::uuid),
                               updated_at = CURRENT_TIMESTAMP
                         WHERE is_operator_default = true OR id = %s::uuid;
                        """,
                        (camera_id, camera_id),
                    )
        _log.info("Câmera ativa '%s' persistida atomicamente no PostgreSQL", camera_name)
        return True
    except Exception as exc:
        _log.error("Erro transacional ao persistir câmera ativa do operário: %s", exc)
        return False
    finally:
        conn.close()


def update_camera_device_status(
    camera_id: str,
    status: str,
    update_last_frame: bool = False,
) -> bool:
    """
    Atualiza atomicamente o status de uma única câmera na tabela `camera_devices`
    usando row-level lock por UUID, permitindo que múltiplas câmeras atualizem
    seus status simultaneamente sem condição de corrida.
    """
    if not _is_valid_uuid(camera_id):
        return False

    conn = get_db_connection()
    if conn is None:
        return False

    try:
        with conn.cursor() as cur:
            if update_last_frame:
                cur.execute(
                    """
                    UPDATE public.camera_devices
                       SET status = %s::public.device_connection_status,
                           last_frame_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP
                     WHERE id = %s::uuid;
                    """,
                    (status, camera_id),
                )
            else:
                cur.execute(
                    """
                    UPDATE public.camera_devices
                       SET status = %s::public.device_connection_status,
                           updated_at = CURRENT_TIMESTAMP
                     WHERE id = %s::uuid;
                    """,
                    (status, camera_id),
                )
        return True
    except Exception as exc:
        _log.warning("Falha ao atualizar status da câmera %s no banco: %s", camera_id, exc)
        return False
    finally:
        conn.close()


def update_dvr_device_status(dvr_id: str, status: str) -> bool:
    """
    Atualiza atomicamente o status e o timestamp `last_checked_at` de um DVR
    específico na tabela `dvr_devices` sem afetar outros dispositivos concorrentes.
    """
    if not _is_valid_uuid(dvr_id):
        return False

    conn = get_db_connection()
    if conn is None:
        return False

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.dvr_devices
                   SET status = %s::public.device_connection_status,
                       last_checked_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP
                 WHERE id = %s::uuid;
                """,
                (status, dvr_id),
            )
        return True
    except Exception as exc:
        _log.warning("Falha ao atualizar status do DVR %s no banco: %s", dvr_id, exc)
        return False
    finally:
        conn.close()
