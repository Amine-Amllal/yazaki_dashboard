"""
RAG Service pour YECMS - Yazaki Dashboard
"""

import hashlib
import json
import os
import shutil
import sqlite3
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEndpointEmbeddings


# Charger les variables depuis le .env du projet Next.js
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if ENV_PATH.exists():
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key.strip(), value)

DB_PATH = Path(__file__).resolve().parent.parent / "prisma" / "dev.db"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
HF_API_KEY = os.environ.get("HF_API_KEY", "")
HF_EMBED_MODEL = "BAAI/bge-m3"
CHROMA_DIR = str(Path(__file__).resolve().parent / "chroma_db_yecms")
CHROMA_COLLECTION = os.environ.get("RAG_CHROMA_COLLECTION", "yecms_rag")
INDEX_SIGNATURE_FILE = Path(__file__).resolve().parent / "rag_index_signature.json"
SIGNATURE_CHECK_INTERVAL_SEC = int(os.environ.get("RAG_SIGNATURE_CHECK_INTERVAL_SEC", "10"))

if not GEMINI_API_KEY:
    print("⚠️ GEMINI_API_KEY non trouvée. Vérifiez votre fichier .env")
if not HF_API_KEY:
    print("⚠️ HF_API_KEY non trouvée. Vérifiez votre fichier .env")
if not DB_PATH.exists():
    print(f"⚠️ Base SQLite introuvable : {DB_PATH}")
    sys.exit(1)


def get_db_connection() -> sqlite3.Connection:
    """Ouvre une connexion SQLite en mode lecture seule."""
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def fetch_all_projects() -> list[dict]:
    """Récupère tous les projets."""
    conn = get_db_connection()
    rows = conn.execute("SELECT id, name, createdAt FROM Project").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_families() -> list[dict]:
    """Récupère toutes les familles."""
    conn = get_db_connection()
    rows = conn.execute("SELECT id, name, createdAt FROM Family").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_phases() -> list[dict]:
    """Récupère toutes les phases."""
    conn = get_db_connection()
    rows = conn.execute("SELECT id, name, createdAt FROM Phase").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_users() -> list[dict]:
    """Récupère tous les utilisateurs (sans mot de passe ni image)."""
    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT id, matricule, nom, prenom, email, fonction, role, active, createdAt
        FROM User
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_dfcs() -> list[dict]:
    """
    Récupère tous les DFC avec les données dénormalisées
    (nom du projet, famille, phase, créateur).
    """
    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT
            d.id,
            d.numero,
            d.description,
            d.faisabilite,
            d.typeDFC,
            d.dateReception,
            d.dateReponse,
            d.delaiReponse,
            d.dateReceptionDerogation,
            d.numeroDerogation,
            d.dateApplicationEstimee,
            d.dateApplicationDerogation,
            d.commentaire,
            d.createdAt,
            d.updatedAt,
            p.name   AS projet,
            f.name   AS famille,
            ph.name  AS phase,
            u.nom    AS createur_nom,
            u.prenom AS createur_prenom,
            u.matricule AS createur_matricule
        FROM DFC d
        JOIN Project p ON d.projectId = p.id
        JOIN Family f ON d.familyId = f.id
        JOIN Phase ph ON d.phaseId = ph.id
        JOIN User u ON d.createdById = u.id
        ORDER BY d.numero ASC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_histories() -> list[dict]:
    """
    Récupère tout l'historique des modifications DFC
    avec le numéro du DFC et le nom de l'utilisateur.
    """
    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT
            h.id,
            h.field,
            h.oldValue,
            h.newValue,
            h.changedAt,
            d.numero AS dfc_numero,
            u.nom AS user_nom,
            u.prenom AS user_prenom
        FROM DFCHistory h
        JOIN DFC d ON h.dfcId = d.id
        JOIN User u ON h.userId = u.id
        ORDER BY h.changedAt DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_dfc_files() -> list[dict]:
    """Récupère les fichiers liés aux DFC."""
    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT
            fi.id,
            fi.originalName,
            fi.mimeType,
            fi.sizeBytes,
            fi.relativePath,
            fi.createdAt,
            d.numero AS dfc_numero,
            u.nom AS uploader_nom,
            u.prenom AS uploader_prenom
        FROM DFCFile fi
        JOIN DFC d ON fi.dfcId = d.id
        JOIN User u ON fi.uploadedById = u.id
        ORDER BY fi.createdAt DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_derogations() -> list[dict]:
    """Récupère toutes les dérogations avec leur contexte DFC."""
    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT
            dr.id,
            dr.numero,
            dr.dateReception,
            dr.dateApplicationEstimee,
            dr.dateApplicationEffective,
            dr.commentaire,
            dr.createdAt,
            dr.updatedAt,
            d.numero AS dfc_numero,
            p.name AS projet,
            f.name AS famille,
            ph.name AS phase,
            u.nom AS createur_nom,
            u.prenom AS createur_prenom
        FROM Derogation dr
        JOIN DFC d ON dr.dfcId = d.id
        JOIN Project p ON d.projectId = p.id
        JOIN Family f ON d.familyId = f.id
        JOIN Phase ph ON d.phaseId = ph.id
        JOIN User u ON dr.createdById = u.id
        ORDER BY dr.updatedAt DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_ecos() -> list[dict]:
    """Récupère tous les ECO avec leur contexte DFC."""
    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT
            e.id,
            e.code,
            e.status,
            e.issuedAt,
            e.commentaire,
            e.createdAt,
            e.updatedAt,
            d.numero AS dfc_numero,
            p.name AS projet,
            f.name AS famille,
            ph.name AS phase,
            u.nom AS createur_nom,
            u.prenom AS createur_prenom
        FROM ECO e
        JOIN DFC d ON e.dfcId = d.id
        JOIN Project p ON d.projectId = p.id
        JOIN Family f ON d.familyId = f.id
        JOIN Phase ph ON d.phaseId = ph.id
        JOIN User u ON e.createdById = u.id
        ORDER BY e.updatedAt DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_stats() -> dict:
    """Récupère les statistiques globales pour enrichir le contexte RAG."""
    conn = get_db_connection()

    total_dfc = conn.execute("SELECT COUNT(*) FROM DFC").fetchone()[0]

    faisabilite_counts = conn.execute(
        """
        SELECT faisabilite, COUNT(*) as count
        FROM DFC GROUP BY faisabilite
        """
    ).fetchall()

    type_counts = conn.execute(
        """
        SELECT typeDFC, COUNT(*) as count
        FROM DFC GROUP BY typeDFC
        """
    ).fetchall()

    project_counts = conn.execute(
        """
        SELECT p.name, COUNT(*) as count
        FROM DFC d JOIN Project p ON d.projectId = p.id
        GROUP BY p.name
        """
    ).fetchall()

    derogations_count = conn.execute("SELECT COUNT(*) FROM Derogation").fetchone()[0]
    eco_count = conn.execute("SELECT COUNT(*) FROM ECO").fetchone()[0]

    conn.close()

    return {
        "total_dfc": total_dfc,
        "total_derogations": derogations_count,
        "total_eco": eco_count,
        "par_faisabilite": {r["faisabilite"]: r["count"] for r in faisabilite_counts},
        "par_type": {r["typeDFC"]: r["count"] for r in type_counts},
        "par_projet": {r["name"]: r["count"] for r in project_counts},
    }


def format_date(val) -> str:
    """Formate une date SQLite/ISO en format lisible."""
    if not val:
        return "N/A"
    try:
        if isinstance(val, datetime):
            return val.strftime("%d/%m/%Y")
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val / 1000).strftime("%d/%m/%Y")
        return datetime.fromisoformat(str(val).replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except Exception:
        return str(val)


def dfc_to_document(dfc: dict) -> dict:
    """Transforme un DFC en document textuel."""
    lines = [
        f"DFC #{dfc['numero']}",
        f"Projet: {dfc['projet']}",
        f"Famille: {dfc['famille']}",
        f"Phase: {dfc['phase']}",
        f"Description: {dfc['description']}",
        f"Faisabilité: {dfc['faisabilite']}",
        f"Type: {dfc['typeDFC']}",
        f"Date de réception: {format_date(dfc['dateReception'])}",
        f"Date de réponse: {format_date(dfc['dateReponse'])}",
        f"Délai de réponse: {dfc['delaiReponse'] or 'N/A'} jours",
        f"Numéro dérogation: {dfc['numeroDerogation'] or 'N/A'}",
        f"Date réception dérogation: {format_date(dfc['dateReceptionDerogation'])}",
        f"Date application estimée: {format_date(dfc['dateApplicationEstimee'])}",
        f"Date application dérogation: {format_date(dfc['dateApplicationDerogation'])}",
        f"Commentaire: {dfc['commentaire'] or 'Aucun'}",
        f"Créé par: {dfc['createur_prenom']} {dfc['createur_nom']} ({dfc['createur_matricule']})",
        f"Date de création: {format_date(dfc['createdAt'])}",
    ]

    return {
        "id": f"dfc-{dfc['id']}",
        "text": "\n".join(lines),
        "metadata": {
            "type": "dfc",
            "numero": dfc["numero"],
            "projet": dfc["projet"],
            "famille": dfc["famille"],
            "phase": dfc["phase"],
            "faisabilite": dfc["faisabilite"],
            "typeDFC": dfc["typeDFC"],
        },
    }


def history_to_document(history_item: dict) -> dict:
    """Transforme une entrée d'historique en document textuel."""
    text = (
        f"Modification DFC #{history_item['dfc_numero']} : "
        f"le champ '{history_item['field']}' a été changé "
        f"de '{history_item['oldValue'] or 'vide'}' à '{history_item['newValue'] or 'vide'}' "
        f"par {history_item['user_prenom']} {history_item['user_nom']} "
        f"le {format_date(history_item['changedAt'])}"
    )

    return {
        "id": f"hist-{history_item['id']}",
        "text": text,
        "metadata": {
            "type": "history",
            "dfc_numero": history_item["dfc_numero"],
            "field": history_item["field"],
        },
    }


def derogation_to_document(derogation: dict) -> dict:
    """Transforme une dérogation en document textuel."""
    lines = [
        f"Dérogation liée au DFC #{derogation['dfc_numero']}",
        f"Projet: {derogation['projet']}",
        f"Famille: {derogation['famille']}",
        f"Phase: {derogation['phase']}",
        f"Numéro dérogation: {derogation['numero'] or 'N/A'}",
        f"Date de réception: {format_date(derogation['dateReception'])}",
        f"Date application estimée: {format_date(derogation['dateApplicationEstimee'])}",
        f"Date application effective: {format_date(derogation['dateApplicationEffective'])}",
        f"Commentaire: {derogation['commentaire'] or 'Aucun'}",
        f"Créée par: {derogation['createur_prenom']} {derogation['createur_nom']}",
        f"Dernière mise à jour: {format_date(derogation['updatedAt'])}",
    ]

    return {
        "id": f"derogation-{derogation['id']}",
        "text": "\n".join(lines),
        "metadata": {
            "type": "derogation",
            "dfc_numero": derogation["dfc_numero"],
            "numero": derogation["numero"] or "N/A",
            "projet": derogation["projet"],
            "famille": derogation["famille"],
            "phase": derogation["phase"],
        },
    }


def eco_to_document(eco: dict) -> dict:
    """Transforme un ECO en document textuel."""
    lines = [
        f"ECO lié au DFC #{eco['dfc_numero']}",
        f"Code ECO: {eco['code']}",
        f"Statut ECO: {eco['status']}",
        f"Projet: {eco['projet']}",
        f"Famille: {eco['famille']}",
        f"Phase: {eco['phase']}",
        f"Date d'émission: {format_date(eco['issuedAt'])}",
        f"Commentaire: {eco['commentaire'] or 'Aucun'}",
        f"Créé par: {eco['createur_prenom']} {eco['createur_nom']}",
        f"Dernière mise à jour: {format_date(eco['updatedAt'])}",
    ]

    return {
        "id": f"eco-{eco['id']}",
        "text": "\n".join(lines),
        "metadata": {
            "type": "eco",
            "dfc_numero": eco["dfc_numero"],
            "code": eco["code"],
            "status": eco["status"],
            "projet": eco["projet"],
            "famille": eco["famille"],
            "phase": eco["phase"],
        },
    }


def dfc_file_to_document(file_item: dict) -> dict:
    """Transforme un fichier DFC en document textuel."""
    text = (
        f"Fichier attaché au DFC #{file_item['dfc_numero']} : "
        f"{file_item['originalName']} ({file_item['mimeType']}, {file_item['sizeBytes']} octets), "
        f"chemin {file_item['relativePath']}, "
        f"uploadé par {file_item['uploader_prenom']} {file_item['uploader_nom']} "
        f"le {format_date(file_item['createdAt'])}"
    )

    return {
        "id": f"dfc-file-{file_item['id']}",
        "text": text,
        "metadata": {
            "type": "dfc_file",
            "dfc_numero": file_item["dfc_numero"],
            "file_name": file_item["originalName"],
            "mime_type": file_item["mimeType"],
        },
    }


def stats_to_document(stats: dict) -> dict:
    """Transforme les statistiques en document textuel."""
    lines = [
        "Statistiques globales YECMS:",
        f"Nombre total de DFC : {stats['total_dfc']}",
        f"Nombre total de dérogations : {stats['total_derogations']}",
        f"Nombre total de ECO : {stats['total_eco']}",
        f"Répartition par faisabilité : {stats['par_faisabilite']}",
        f"Répartition par type : {stats['par_type']}",
        f"Répartition par projet : {stats['par_projet']}",
    ]

    return {
        "id": "stats-global",
        "text": "\n".join(lines),
        "metadata": {"type": "stats"},
    }


def build_all_documents() -> list[dict]:
    """Construit tous les documents à indexer dans ChromaDB."""
    documents = []

    dfcs = fetch_all_dfcs()
    for dfc in dfcs:
        documents.append(dfc_to_document(dfc))

    derogations = fetch_all_derogations()
    for derogation in derogations:
        documents.append(derogation_to_document(derogation))

    ecos = fetch_all_ecos()
    for eco in ecos:
        documents.append(eco_to_document(eco))

    histories = fetch_all_histories()
    for history_item in histories:
        documents.append(history_to_document(history_item))

    files = fetch_all_dfc_files()
    for file_item in files:
        documents.append(dfc_file_to_document(file_item))

    stats = fetch_stats()
    documents.append(stats_to_document(stats))

    print(f"{len(documents)} documents construits:")
    print(f"   - {len(dfcs)} DFC")
    print(f"   - {len(derogations)} dérogations")
    print(f"   - {len(ecos)} ECO")
    print(f"   - {len(histories)} entrées d'historique")
    print(f"   - {len(files)} fichiers DFC")
    print("   - 1 document de statistiques")

    return documents


def build_langchain_documents() -> list[Document]:
    """Convertit les documents bruts en Document LangChain."""
    raw_docs = build_all_documents()
    return [
        Document(page_content=doc["text"], metadata={**doc["metadata"], "doc_id": doc["id"]})
        for doc in raw_docs
    ]


embedding_function = HuggingFaceEndpointEmbeddings(
    model=HF_EMBED_MODEL,
    huggingfacehub_api_token=HF_API_KEY,
)

llm = ChatGoogleGenerativeAI(
    model=GEMINI_MODEL,
    google_api_key=GEMINI_API_KEY,
    temperature=0.2,
)

template = """Tu es l'assistant IA expert du système YECMS (Yazaki Engineering Change Management System) \
déployé chez Yazaki Morocco. Tu aides les ingénieurs PP (Process Preparation) à consulter, \
analyser et comprendre les DFC (Demandes de Faisabilité de Changement).

RÈGLES STRICTES :
1. Réponds UNIQUEMENT en français.
2. Base ta réponse EXCLUSIVEMENT sur le contexte fourni ci-dessous.
3. Si l'information demandée n'est PAS dans le contexte, réponds simplement que l'information n'est pas disponible.
4. Ne fabrique JAMAIS de données. Ne suppose JAMAIS de valeurs.
5. Quand tu cites un DFC, mentionne toujours son numéro (ex: DFC #3).
6. Pour les questions chiffrées (combien, total, pourcentage), donne des chiffres précis.
7. Structure ta réponse de manière claire avec des listes à puces si nécessaire.
8. Si la question concerne un historique de modification, précise qui a fait le changement et quand.
9. Sois concis mais complet. Pas de bavardage inutile.
10. Si on te demande la liste des DFC, présente-les sous forme de tableau ou liste structurée.

GLOSSAIRE YECMS :
- DFC : Demande de Faisabilité de Changement
- Faisabilité : OUI (accepté), NON (refusé), EN_COURS (en attente), A_CLARIFIER (besoin d'info)
- Type DFC : T1 (mineur), T2 (moyen), T3 (majeur), MISTAKED (erreur)
- Phase : étape du cycle de vie du produit
- Famille : catégorie de produit (connecteurs, câbles, etc.)
- Dérogation : autorisation temporaire d'écart par rapport à la norme
- ECO : Engineering Change Order, ordre de changement technique
- PP : Process Preparation (préparation de la production)
- Délai de réponse : nombre de jours entre réception et réponse

CONTEXTE (données extraites de la base YECMS) :
{context}

QUESTION DE L'UTILISATEUR :
{question}

RÉPONSE :"""

prompt = ChatPromptTemplate.from_template(template)


def format_docs(docs: list[Document]) -> str:
    """Formate les documents récupérés en texte pour le prompt."""
    return "\n---\n".join(doc.page_content for doc in docs)


SIGNATURE_TABLE_COLUMNS = {
    "Project": ["id", "name", "createdAt"],
    "Family": ["id", "name", "createdAt"],
    "Phase": ["id", "name", "createdAt"],
    "User": [
        "id",
        "matricule",
        "nom",
        "prenom",
        "email",
        "fonction",
        "role",
        "active",
        "updatedAt",
        "createdAt",
    ],
    "DFC": [
        "id",
        "numero",
        "projectId",
        "familyId",
        "phaseId",
        "description",
        "faisabilite",
        "typeDFC",
        "dateReception",
        "dateReponse",
        "delaiReponse",
        "dateReceptionDerogation",
        "numeroDerogation",
        "dateApplicationEstimee",
        "dateApplicationDerogation",
        "commentaire",
        "createdById",
        "createdAt",
        "updatedAt",
    ],
    "DFCHistory": ["id", "dfcId", "userId", "field", "oldValue", "newValue", "changedAt"],
    "DFCFile": [
        "id",
        "dfcId",
        "originalName",
        "mimeType",
        "sizeBytes",
        "relativePath",
        "uploadedById",
        "createdAt",
    ],
    "Derogation": [
        "id",
        "dfcId",
        "numero",
        "dateReception",
        "dateApplicationEstimee",
        "dateApplicationEffective",
        "commentaire",
        "createdById",
        "createdAt",
        "updatedAt",
    ],
    "ECO": ["id", "dfcId", "code", "status", "issuedAt", "commentaire", "createdById", "createdAt", "updatedAt"],
}


# Variables globales initialisées au premier appel
_vectorstore = None
_retriever = None
_rag_chain = None
_index_signature = None
_last_signature_check_at = 0.0
_index_lock = threading.Lock()


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def _normalize_value(value):
    if isinstance(value, bytes):
        return value.hex()
    return value


def _table_schema_signature(conn: sqlite3.Connection, table_name: str) -> dict:
    columns = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    fks = conn.execute(f'PRAGMA foreign_key_list("{table_name}")').fetchall()

    cols_payload = [
        {
            "name": c[1],
            "type": c[2],
            "notnull": c[3],
            "default": c[4],
            "pk": c[5],
        }
        for c in columns
    ]
    fks_payload = [
        {
            "id": fk[0],
            "seq": fk[1],
            "ref_table": fk[2],
            "from": fk[3],
            "to": fk[4],
            "on_update": fk[5],
            "on_delete": fk[6],
        }
        for fk in fks
    ]

    return {
        "columns": cols_payload,
        "foreign_keys": fks_payload,
    }


def _table_data_signature(conn: sqlite3.Connection, table_name: str, preferred_columns: list[str]) -> dict:
    columns_info = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    existing_columns = {c[1] for c in columns_info}
    selected_columns = [col for col in preferred_columns if col in existing_columns]
    if not selected_columns:
        selected_columns = [c[1] for c in columns_info]

    if "id" in existing_columns:
        order_by = '"id"'
    elif "numero" in existing_columns:
        order_by = '"numero"'
    else:
        order_by = "rowid"

    quoted_cols = ", ".join(f'"{col}"' for col in selected_columns)
    rows = conn.execute(f'SELECT {quoted_cols} FROM "{table_name}" ORDER BY {order_by}').fetchall()

    hasher = hashlib.sha256()
    for row in rows:
        normalized_row = [_normalize_value(v) for v in row]
        hasher.update(
            json.dumps(normalized_row, ensure_ascii=False, default=str, separators=(",", ":")).encode("utf-8")
        )

    return {
        "row_count": len(rows),
        "digest": hasher.hexdigest(),
        "columns": selected_columns,
    }


def compute_db_signature() -> tuple[str, dict]:
    """
    Construit une signature robuste du périmètre RAG:
    - structure des tables (colonnes + clés étrangères)
    - contenu des tables indexées (digest déterministe)
    """
    conn = get_db_connection()
    try:
        schema_version = conn.execute("PRAGMA schema_version").fetchone()[0]
        payload = {
            "db_path": str(DB_PATH),
            "schema_version": schema_version,
            "tables": {},
        }

        for table_name, preferred_cols in SIGNATURE_TABLE_COLUMNS.items():
            if not _table_exists(conn, table_name):
                continue
            payload["tables"][table_name] = {
                "schema": _table_schema_signature(conn, table_name),
                "data": _table_data_signature(conn, table_name, preferred_cols),
            }

        signature = hashlib.sha256(
            json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()

        return signature, payload
    finally:
        conn.close()


def _load_saved_signature() -> str | None:
    if not INDEX_SIGNATURE_FILE.exists():
        return None
    try:
        with open(INDEX_SIGNATURE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("db_path") != str(DB_PATH):
            return None
        return data.get("signature")
    except Exception:
        return None


def _save_signature(signature: str, payload: dict, doc_count: int):
    data = {
        "db_path": str(DB_PATH),
        "signature": signature,
        "saved_at": datetime.now().isoformat(),
        "doc_count": doc_count,
        "tables": list(payload.get("tables", {}).keys()),
    }
    with open(INDEX_SIGNATURE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _build_rag_chain(retriever):
    return (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )


def _load_existing_vectorstore_if_valid(current_signature: str):
    saved_signature = _load_saved_signature()
    if saved_signature != current_signature:
        return None
    if not Path(CHROMA_DIR).exists():
        return None

    vectorstore = Chroma(
        collection_name=CHROMA_COLLECTION,
        embedding_function=embedding_function,
        persist_directory=CHROMA_DIR,
    )

    try:
        count = vectorstore._collection.count()  # noqa: SLF001
    except Exception:
        count = 0

    if count <= 0:
        return None

    print(f"♻️ Index Chroma réutilisé (signature identique) - {count} vecteurs.")
    return vectorstore


def _init_rag(force_rebuild: bool = False):
    """Initialise le vectorstore, retriever et la chaîne RAG."""
    global _vectorstore, _retriever, _rag_chain, _index_signature, _last_signature_check_at

    with _index_lock:
        current_signature, signature_payload = compute_db_signature()

        if not force_rebuild:
            existing_vectorstore = _load_existing_vectorstore_if_valid(current_signature)
            if existing_vectorstore is not None:
                _vectorstore = existing_vectorstore
                _retriever = _vectorstore.as_retriever(
                    search_type="mmr",
                    search_kwargs={"k": 12, "fetch_k": 36},
                )
                _rag_chain = _build_rag_chain(_retriever)
                _index_signature = current_signature
                _last_signature_check_at = time.time()
                return

        print("⏳ (Re)indexation des documents dans ChromaDB...")
        docs = build_langchain_documents()
        doc_ids = [doc.metadata.get("doc_id") for doc in docs]

        _vectorstore = None
        _retriever = None
        _rag_chain = None

        if Path(CHROMA_DIR).exists():
            shutil.rmtree(CHROMA_DIR, ignore_errors=True)

        _vectorstore = Chroma.from_documents(
            documents=docs,
            embedding=embedding_function,
            ids=doc_ids,
            collection_name=CHROMA_COLLECTION,
            persist_directory=CHROMA_DIR,
        )
        _retriever = _vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={"k": 12, "fetch_k": 36},
        )
        _rag_chain = _build_rag_chain(_retriever)

        _index_signature = current_signature
        _last_signature_check_at = time.time()
        _save_signature(current_signature, signature_payload, len(docs))

        print(f"✅ ChromaDB prêt - {len(docs)} documents indexés.")


def _ensure_index_is_fresh(force_reindex: bool = False):
    """Vérifie la signature DB et reindexe uniquement si changement détecté."""
    global _last_signature_check_at

    if force_reindex or _vectorstore is None or _retriever is None or _rag_chain is None:
        _init_rag(force_rebuild=force_reindex)
        return

    now = time.time()
    if (now - _last_signature_check_at) < SIGNATURE_CHECK_INTERVAL_SEC:
        return

    _last_signature_check_at = now
    current_signature, _ = compute_db_signature()
    if current_signature != _index_signature:
        print("🔄 Changement DB détecté (tables + références) -> reindex automatique.")
        _init_rag(force_rebuild=True)


def get_retriever():
    _ensure_index_is_fresh()
    return _retriever


def get_rag_chain():
    _ensure_index_is_fresh()
    return _rag_chain


def rag_query(question: str) -> dict:
    """Exécute une requête RAG complète."""
    retriever = get_retriever()
    chain = get_rag_chain()

    source_docs = retriever.invoke(question)
    answer = chain.invoke(question)
    sources = list({doc.metadata.get("doc_id", "unknown") for doc in source_docs})

    return {"answer": answer, "sources": sources}


def reindex() -> int:
    """Force une réindexation complète."""
    _ensure_index_is_fresh(force_reindex=True)
    return len(build_all_documents())


# Flask app
app = Flask(__name__)
CORS(
    app,
    origins=[
        "http://localhost:3000",
        os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000"),
    ],
)

# Token d'authentification partagé entre Next.js et le service RAG
RAG_API_TOKEN = os.environ.get("RAG_API_TOKEN", "")


def require_auth(f):
    """Décorateur pour protéger les endpoints avec un token Bearer."""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if not RAG_API_TOKEN:
            return f(*args, **kwargs)
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer ") or auth_header[7:] != RAG_API_TOKEN:
            return jsonify({"error": "Non autorisé"}), 401
        return f(*args, **kwargs)

    return decorated


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})


@app.route("/api/data", methods=["GET"])
@require_auth
def get_data():
    """Retourne les données brutes de la BD (protégé par token)."""
    return jsonify(
        {
            "projects": fetch_all_projects(),
            "families": fetch_all_families(),
            "phases": fetch_all_phases(),
            "users": fetch_all_users(),
            "dfcs": fetch_all_dfcs(),
            "dfc_files": fetch_all_dfc_files(),
            "derogations": fetch_all_derogations(),
            "ecos": fetch_all_ecos(),
            "histories": fetch_all_histories(),
            "stats": fetch_stats(),
        }
    )


@app.route("/api/documents", methods=["GET"])
@require_auth
def get_documents():
    """Retourne tous les documents formatés pour le RAG (protégé par token)."""
    docs = build_all_documents()
    return jsonify({"count": len(docs), "documents": docs})


@app.route("/api/chat", methods=["POST"])
@require_auth
def chat():
    """Endpoint principal RAG (protégé par token)."""
    data = request.get_json() or {}
    question = data.get("question", "")
    if not question:
        return jsonify({"error": "Question manquante"}), 400

    try:
        result = rag_query(question)
        return jsonify(result)
    except Exception as exc:
        import traceback

        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500


@app.route("/api/reindex", methods=["POST"])
@require_auth
def do_reindex():
    """Force une réindexation de toutes les données SQLite."""
    try:
        count = reindex()
        return jsonify({"status": "ok", "indexed": count})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


RAG_HOST = os.environ.get("RAG_HOST", "127.0.0.1")
try:
    RAG_PORT = int(os.environ.get("RAG_PORT", "5000"))
except ValueError:
    RAG_PORT = 5000


if __name__ == "__main__":
    print("=" * 50)
    print("  YECMS RAG Service")
    print("=" * 50)

    docs = build_all_documents()
    print("\nExemple de document indexé:")
    print("-" * 40)
    if docs:
        print(docs[0]["text"])
    print("-" * 40)

    print(f"\nDémarrage du serveur Flask sur http://{RAG_HOST}:{RAG_PORT}")
    app.run(host=RAG_HOST, port=RAG_PORT, debug=False)
