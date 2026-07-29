import os
import json
import hashlib
from typing import Dict, Any, List, Optional

class DocumentManager:
    """
    DocumentManager handles reading knowledge base files (.md, .json, .pdf),
    caching hashes (MD5) for fast lookup, and storing structured config.
    """
    def __init__(self, docs_dirs):
        if isinstance(docs_dirs, str):
            self.docs_dirs = [docs_dirs]
        else:
            self.docs_dirs = docs_dirs

        self.doc_hash_cache: Dict[str, str] = {}
        self.doc_content_cache: Dict[str, str] = {}
        self.structured_config: Dict[str, Any] = {}
        self.load_documents()

    def _get_hash(self, text: str) -> str:
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    def load_documents(self):
        """Read and cache markdown, json, and pdf files."""
        for folder in self.docs_dirs:
            if not os.path.exists(folder):
                continue

            for root, _, files in os.walk(folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    ext = file.lower().split('.')[-1]

                    try:
                        if ext in ['md', 'txt']:
                            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                content = f.read()
                                self.doc_hash_cache[file] = self._get_hash(content)
                                self.doc_content_cache[file] = content

                        elif ext == 'json':
                            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                data = json.load(f)
                                content = json.dumps(data)
                                self.doc_hash_cache[file] = self._get_hash(content)
                                self.doc_content_cache[file] = content
                                if file == 'university_config.json':
                                    self.structured_config = data

                        elif ext == 'pdf':
                            text = self._read_pdf(file_path)
                            if text:
                                self.doc_hash_cache[file] = self._get_hash(text)
                                self.doc_content_cache[file] = text

                    except Exception as e:
                        print(f"Error reading {file}: {e}")

    def _read_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF file."""
        try:
            import pdfplumber
            text = ""
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    txt = page.extract_text()
                    if txt:
                        text += txt + "\n"
            return text
        except Exception:
            try:
                from pypdf import PdfReader
                reader = PdfReader(pdf_path)
                text = ""
                for page in reader.pages:
                    txt = page.extract_text()
                    if txt:
                        text += txt + "\n"
                return text
            except Exception:
                return ""

    def search_program_fee(self, program_code: str) -> Optional[Dict[str, Any]]:
        """Fast dictionary lookup for program fees and seat details."""
        if not self.structured_config:
            return None

        departments = self.structured_config.get("departments", {})
        for dept_name, dept_data in departments.items():
            programs = dept_data.get("programs", {})
            if program_code in programs:
                result = dict(programs[program_code])
                result["faculty"] = dept_data.get("faculty")
                return result
        return None
