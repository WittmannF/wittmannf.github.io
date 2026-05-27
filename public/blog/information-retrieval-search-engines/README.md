# Information Retrieval Search Engines Notebook

Runnable notebook for the blog post:

- English: `/blog/information-retrieval-search-engines`
- Portuguese: `/pt/blog/information-retrieval-search-engines-pt`

The notebook is designed to run even without heavy ML dependencies, using small fallback implementations where needed. Installing the requirements enables the full examples with `sentence-transformers`, `numpy`, and FAISS.

## Setup with uv

Run these commands from the repository root:

```bash
uv venv .venv
source .venv/bin/activate
uv pip install -r public/blog/information-retrieval-search-engines/requirements.txt
python -m ipykernel install --user --name blog-ir-search --display-name "Blog IR Search"
```

Then start Jupyter:

```bash
python -m notebook public/blog/information-retrieval-search-engines/information-retrieval-search-engines.ipynb
```

Select the `Blog IR Search` kernel if Jupyter does not pick it automatically.

## Files

- `information-retrieval-search-engines.ipynb` - executable notebook with the article examples
- `requirements.txt` - optional dependencies for the full local experience

## Notes

- The notebook has fallbacks for `sentence-transformers`, `faiss`, and the cross-encoder reranker, so it can still run without downloading models.
- Installing `sentence-transformers` may download model weights on first execution.
- The `.venv/` directory is intentionally ignored by Git.
