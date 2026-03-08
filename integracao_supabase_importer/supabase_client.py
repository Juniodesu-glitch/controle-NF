from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import requests


class SupabaseClient:
    def __init__(self, base_url: str, service_role_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    def _url(self, path: str) -> str:
        return f"{self.base_url}/rest/v1/{path.lstrip('/')}"

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, str]] = None,
        body: Optional[Dict[str, Any] | List[Dict[str, Any]]] = None,
        prefer: Optional[str] = None,
    ) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer

        response = requests.request(
            method=method,
            url=self._url(path),
            params=params,
            headers=headers,
            data=json.dumps(body) if body is not None else None,
            timeout=30,
        )
        if not response.ok:
            raise RuntimeError(f"Supabase {method} {path} failed: {response.status_code} - {response.text}")

        if not response.text:
            return None

        try:
            return response.json()
        except Exception:
            return response.text

    def find_nf_by_numero(self, numero_nf: str) -> Optional[Dict[str, Any]]:
        result = self.request(
            "GET",
            "nfs",
            params={"select": "id,numero_nf", "numero_nf": f"eq.{numero_nf}", "limit": "1"},
        )
        if isinstance(result, list) and result:
            return result[0]
        return None

    def upsert_nf(self, nf: Dict[str, Any]) -> int:
        numero_nf = str(nf.get("numero_nf", "")).strip()
        if not numero_nf:
            raise ValueError("numero_nf is required")

        existing = self.find_nf_by_numero(numero_nf)
        payload = {
            "numero_nf": numero_nf,
            "serie": nf.get("serie") or "1",
            "pedido": nf.get("pedido") or "-",
            "cliente": nf.get("cliente") or "Cliente nao informado",
            "transportadora": nf.get("transportadora") or "Nao informada",
            "artigo": nf.get("artigo") or "-",
            "quantidade_itens": float(nf.get("quantidade_itens") or 0),
            "metros": float(nf.get("metros") or 0),
            "peso_bruto": float(nf.get("peso_bruto") or 0),
            "valor_total": float(nf.get("valor_total") or 0),
            "data_emissao": nf.get("data_emissao"),
            "status": nf.get("status") or "pendente",
            "origem_xml": nf.get("origem_xml"),
        }

        if existing:
            self.request(
                "PATCH",
                "nfs",
                params={"id": f"eq.{existing['id']}"},
                body=payload,
            )
            return int(existing["id"])

        inserted = self.request(
            "POST",
            "nfs",
            params={"select": "id"},
            body=payload,
            prefer="return=representation",
        )
        if not isinstance(inserted, list) or not inserted:
            raise RuntimeError("Failed to insert nfs row")
        return int(inserted[0]["id"])

    def replace_nf_itens(self, nf_id: int, itens: List[Dict[str, Any]]) -> None:
        self.request("DELETE", "nf_itens", params={"nf_id": f"eq.{nf_id}"})

        if not itens:
            return

        rows = []
        for item in itens:
            rows.append(
                {
                    "nf_id": nf_id,
                    "codigo": item.get("codigo"),
                    "descricao": item.get("descricao"),
                    "unidade": item.get("unidade"),
                    "quantidade": float(item.get("quantidade") or 0),
                    "valor_unitario": float(item.get("valor_unitario") or 0),
                    "valor_total": float(item.get("valor_total") or 0),
                }
            )

        self.request("POST", "nf_itens", body=rows)

    def add_import_log(self, arquivo: str, numero_nf: str, chave_acesso: str, status: str, mensagem: str) -> None:
        self.request(
            "POST",
            "import_logs",
            body={
                "arquivo": arquivo,
                "numero_nf": numero_nf,
                "chave_acesso": chave_acesso,
                "status": status,
                "mensagem": mensagem,
            },
        )
