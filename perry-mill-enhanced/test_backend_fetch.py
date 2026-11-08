"""Small integration helper to POST to the Flask backend endpoint

Usage:
  python3 test_backend_fetch.py "https://example.com/article"

This script expects the Flask app to be running locally on http://127.0.0.1:5000
Install requests if you don't have it: pip install requests
"""
import sys
import json
import requests

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 test_backend_fetch.py <article_url>")
        sys.exit(2)

    url = sys.argv[1]
    endpoint = 'http://127.0.0.1:5000/api/article/fetch'
    payload = {'url': url}
    print(f"POST {endpoint} -> {payload}")
    resp = requests.post(endpoint, json=payload, timeout=40)
    try:
        data = resp.json()
        print(json.dumps(data, indent=2))
    except Exception:
        print('Non-JSON response (status {})'.format(resp.status_code))
        print(resp.text)

if __name__ == '__main__':
    main()
