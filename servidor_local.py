"""Servidor HTTP local para servir o aplicativo via http://localhost:5500.

Resolve o problema de CORS do protocolo file:// que impede o navegador
de fazer fetch() ao Supabase.
"""

import http.server
import os
import sys

PORT = 5500
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Handler que serve arquivos estaticos sem poluir o console."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Silencia logs de request para nao poluir o terminal
        pass

    def end_headers(self):
        # Adiciona headers CORS para permitir chamadas ao Supabase
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    with http.server.HTTPServer(("127.0.0.1", PORT), QuietHandler) as httpd:
        print(f"Servidor rodando em http://127.0.0.1:{PORT}")
        print(f"Diretorio: {DIRECTORY}")
        print("Pressione Ctrl+C para parar.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")
            sys.exit(0)
