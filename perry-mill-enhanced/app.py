import os
import json
import shutil
import subprocess
from typing import Optional
from urllib.parse import urlparse

from flask import Flask, request, jsonify, abort


def create_app() -> Flask:
	# Serve static files from the `static/` folder by default
	app = Flask(__name__, static_folder='static', static_url_path='')

	def validate_url(u: str) -> Optional[str]:
		try:
			p = urlparse(u)
			if p.scheme not in ('http', 'https'):
				return None
			if not p.netloc:
				return None
			return u
		except Exception:
			return None

	@app.route('/api/article/fetch', methods=['POST'])
	def fetch_article():
		data = request.get_json(silent=True)
		if not data or 'url' not in data:
			return jsonify({'ok': False, 'error': 'Missing JSON body with "url" field'}), 400

		url = data.get('url')
		url = validate_url(url)
		if not url:
			return jsonify({'ok': False, 'error': 'Invalid URL'}), 400

		node = shutil.which('node') or shutil.which('nodejs')
		if not node:
			return jsonify({'ok': False, 'error': 'Node.js not found on server'}), 500

		script_path = os.path.join(os.path.dirname(__file__), 'scraper', 'fetch-article.js')
		if not os.path.isfile(script_path):
			return jsonify({'ok': False, 'error': 'Scraper script not found'}), 500

		# Run the Node scraper as a subprocess with a timeout
		try:
			proc = subprocess.run(
				[node, script_path, url],
				capture_output=True,
				text=True,
				timeout=30,
				check=False,
			)
		except subprocess.TimeoutExpired:
			return jsonify({'ok': False, 'error': 'Scraper timed out'}), 504
		except Exception as exc:
			return jsonify({'ok': False, 'error': f'Failed to start scraper: {exc}'}), 500

		stdout = proc.stdout.strip() if proc.stdout else ''
		stderr = proc.stderr.strip() if proc.stderr else ''

		if proc.returncode != 0:
			# Try to parse structured error from stderr
			try:
				err = json.loads(stderr)
				return jsonify({'ok': False, 'error': err.get('error', stderr)}), 502
			except Exception:
				return jsonify({'ok': False, 'error': stderr or 'Scraper failed'}), 502

		# Parse JSON output from stdout
		try:
			parsed = json.loads(stdout) if stdout else {}
		except Exception:
			return jsonify({'ok': False, 'error': 'Failed to parse scraper output'}), 502

		# Ensure we only return expected keys
		article = {
			'title': parsed.get('title'),
			'content': parsed.get('content'),
			'author': parsed.get('author'),
			'publishedDate': parsed.get('publishedDate'),
			'image': parsed.get('image'),
			'url': parsed.get('url', url),
		}

		return jsonify({'ok': True, 'article': article}), 200

	return app


app = create_app()


if __name__ == '__main__':
	# Use PORT env or default 5000
	port = int(os.environ.get('PORT', 5000))
	app.run(host='0.0.0.0', port=port, debug=True)

