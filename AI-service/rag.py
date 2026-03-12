"""
RAG Service pour YECMS - Yazaki Dashboard                    
"""

import sqlite3
import os
import sys
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.documents import Document


# Charger les variables depuis le .env du projet Next.js
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if ENV_PATH.exists():
    with open(ENV_PATH) as f:
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

if not GEMINI_API_KEY:
    print("⚠️  GEMINI_API_KEY non trouvée. Vérifiez votre fichier .env")
if not HF_API_KEY:
    print("⚠️  HF_API_KEY non trouvée. Vérifiez votre fichier .env")
if not DB_PATH.exists():
    print(f"⚠️  Base SQLite introuvable : {DB_PATH}")
    sys.exit(1)
# ici on fait la recuperation des donne mes d'ames et monsieures (c'est l'etape laplus important en rag )

def get_db_connection():
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
    rows = conn.execute("""
        SELECT id, matricule, nom, prenom, email, fonction, role, active, createdAt
        FROM User
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_dfcs() -> list[dict]:
    """
    Récupère tous les DFC avec les données dénormalisées
    (nom du projet, famille, phase, créateur).
    C'est la table principale pour le RAG.
    """
    conn = get_db_connection()
    rows = conn.execute("""
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
        JOIN Project p  ON d.projectId  = p.id
        JOIN Family f   ON d.familyId   = f.id
        JOIN Phase  ph  ON d.phaseId    = ph.id
        JOIN User   u   ON d.createdById = u.id
        ORDER BY d.numero ASC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_all_histories() -> list[dict]:
    """
    Récupère tout l'historique des modifications DFC
    avec le numéro du DFC et le nom de l'utilisateur.
    """
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT
            h.id,
            h.field,
            h.oldValue,
            h.newValue,
            h.changedAt,
            d.numero AS dfc_numero,
            u.nom    AS user_nom,
            u.prenom AS user_prenom
        FROM DFCHistory h
        JOIN DFC  d ON h.dfcId  = d.id
        JOIN User u ON h.userId = u.id
        ORDER BY h.changedAt DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_stats() -> dict:
    """Récupère les statistiques globales pour enrichir le contexte RAG."""
    conn = get_db_connection()

    total_dfc = conn.execute("SELECT COUNT(*) FROM DFC").fetchone()[0]

    faisabilite_counts = conn.execute("""
        SELECT faisabilite, COUNT(*) as count
        FROM DFC GROUP BY faisabilite
    """).fetchall()

    type_counts = conn.execute("""
        SELECT typeDFC, COUNT(*) as count
        FROM DFC GROUP BY typeDFC
    """).fetchall()

    project_counts = conn.execute("""
        SELECT p.name, COUNT(*) as count
        FROM DFC d JOIN Project p ON d.projectId = p.id
        GROUP BY p.name
    """).fetchall()

    conn.close()

    return {
        "total_dfc": total_dfc,
        "par_faisabilite": {r["faisabilite"]: r["count"] for r in faisabilite_counts},
        "par_type": {r["typeDFC"]: r["count"] for r in type_counts},
        "par_projet": {r["name"]: r["count"] for r in project_counts},
    }
#  Transformation en documents textuels
#  (format lisible pour le chunking/embedding)
def format_date(val: str | None) -> str:
    """Formate une date ISO en format lisible."""
    if not val:
        return "N/A"
    try:
        # Les dates SQLite de Prisma sont en millisecondes epoch ou ISO
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val / 1000).strftime("%d/%m/%Y")
        return datetime.fromisoformat(val.replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except Exception:
        return str(val)


def dfc_to_document(dfc: dict) -> dict:
    """
    Transforme un DFC (dict) en document textuel structuré.
    Retourne : { "id": str, "text": str, "metadata": dict }
    """
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

    text = "\n".join(lines)

    metadata = {
        "type": "dfc",
        "numero": dfc["numero"],
        "projet": dfc["projet"],
        "famille": dfc["famille"],
        "phase": dfc["phase"],
        "faisabilite": dfc["faisabilite"],
        "typeDFC": dfc["typeDFC"],
    }

    return {"id": f"dfc-{dfc['id']}", "text": text, "metadata": metadata}


def history_to_document(h: dict) -> dict:
    """Transforme une entrée d'historique en document textuel."""
    text = (
        f"Modification DFC #{h['dfc_numero']} : "
        f"Le champ '{h['field']}' a été changé "
        f"de '{h['oldValue'] or 'vide'}' à '{h['newValue'] or 'vide'}' "
        f"par {h['user_prenom']} {h['user_nom']} "
        f"le {format_date(h['changedAt'])}"
    )

    metadata = {
        "type": "history",
        "dfc_numero": h["dfc_numero"],
        "field": h["field"],
    }

    return {"id": f"hist-{h['id']}", "text": text, "metadata": metadata}


def stats_to_document(stats: dict) -> dict:
    """Transforme les statistiques en un document textuel."""
    lines = [
        f"Statistiques globales YECMS :",
        f"Nombre total de DFC : {stats['total_dfc']}",
        f"Répartition par faisabilité : {stats['par_faisabilite']}",
        f"Répartition par type : {stats['par_type']}",
        f"Répartition par projet : {stats['par_projet']}",
    ]

    return {
        "id": "stats-global",
        "text": "\n".join(lines),
        "metadata": {"type": "stats"},
    }

# tres important : c'est cette fonction qui construit les documents à indexer dans ChromaDB
def build_all_documents() -> list[dict]:
    """
    Construit TOUS les documents pour l'indexation RAG.
    Retourne une liste de { "id", "text", "metadata" }.
    C'est cette fonction que tu utiliseras dans l'étape d'embedding.
    """
    documents = []

    # 1. Documents DFC (table principale)
    dfcs = fetch_all_dfcs()
    for dfc in dfcs:
        documents.append(dfc_to_document(dfc))

    # 2. Documents Historique
    histories = fetch_all_histories()
    for h in histories:
        documents.append(history_to_document(h))

    # 3. Document Statistiques
    stats = fetch_stats()
    documents.append(stats_to_document(stats))

    print(f"{len(documents)} documents construits :")
    print(f"   - {len(dfcs)} DFC")
    print(f"   - {len(histories)} entrées d'historique")
    print(f"   - 1 document de statistiques")

    return documents


def build_langchain_documents() -> list[Document]:
    """
    Convertit les dicts de build_all_documents() en objets Document de LangChain
    (nécessaire pour Chroma.from_documents).
    """
    raw_docs = build_all_documents()
    return [
        Document(page_content=d["text"], metadata={**d["metadata"], "doc_id": d["id"]})
        for d in raw_docs
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
3. Si l'information demandée n'est PAS dans le contexte, réponder de maniere simple et dire que je peux t'aider ?
   
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


# Variables globales initialisées au premier appel
_vectorstore = None
_retriever = None
_rag_chain = None


def _init_rag():
    """Initialise le vectorstore, retriever et la chaîne RAG (une seule fois)."""
    global _vectorstore, _retriever, _rag_chain

    print("⏳ Indexation des documents dans ChromaDB...")
    docs = build_langchain_documents()

    _vectorstore = Chroma.from_documents(
        documents=docs,
        embedding=embedding_function,
        persist_directory=CHROMA_DIR,
    )
    _retriever = _vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 10},
    )
    _rag_chain = (
        {"context": _retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    print(f" ChromaDB prêt — {len(docs)} documents indexés.")


def get_retriever():
    if _retriever is None:
        _init_rag()
    return _retriever


def get_rag_chain():
    if _rag_chain is None:
        _init_rag()
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
    """Réindexe toutes les données SQLite dans ChromaDB."""
    global _vectorstore, _retriever, _rag_chain
    _vectorstore = None
    _retriever = None
    _rag_chain = None
    _init_rag()
    return len(build_all_documents())


#  FLASK APP

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:3000",
    os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000"),
])

# Token d'authentification partagé entre Next.js et le service RAG
RAG_API_TOKEN = os.environ.get("RAG_API_TOKEN", "")


def require_auth(f):
    """Décorateur pour protéger les endpoints avec un token Bearer."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not RAG_API_TOKEN:
            # Si aucun token configuré, on laisse passer (dev uniquement)
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
    return jsonify({
        "projects": fetch_all_projects(),
        "families": fetch_all_families(),
        "phases": fetch_all_phases(),
        "users": fetch_all_users(),
        "dfcs": fetch_all_dfcs(),
        "histories": fetch_all_histories(),
        "stats": fetch_stats(),
    })


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
    data = request.get_json()
    question = data.get("question", "")
    if not question:
        return jsonify({"error": "Question manquante"}), 400
    try:
        result = rag_query(question)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/reindex", methods=["POST"])
@require_auth
def do_reindex():
    """Réindexer les données SQLite dans ChromaDB (protégé par token)."""
    try:
        count = reindex()
        return jsonify({"status": "ok", "indexed": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

RAG_HOST = os.environ.get("RAG_HOST")
RAG_PORT = int(os.environ.get("RAG_PORT"))

if __name__ == "__main__":
    print("=" * 50)
    print("  YECMS RAG Service")
    print("=" * 50)

    docs = build_all_documents()
    print("\n📄 Exemple de document DFC :")
    print("-" * 40)
    if docs:
        print(docs[0]["text"])
    print("-" * 40)

    print("\n Démarrage du serveur Flask sur http://localhost:5000")
    app.run(host=RAG_HOST, port=RAG_PORT, debug=False)

