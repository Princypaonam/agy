from flask import Flask, render_template, jsonify
import urllib.request
import xml.etree.ElementTree as ET
import re
import html
from datetime import datetime

app = Flask(__name__)

def clean_html_tags(html_text):
    """Utility to strip HTML tags for plain-text representations like Tweet pre-fills."""
    # First, let's convert link tags to text [text](url) or just text
    clean_text = re.sub(r'<a href="([^"]+)">([^<]+)</a>', r'\2 (\1)', html_text)
    # Remove all other tags
    clean_text = re.sub(r'<[^>]+>', '', clean_text)
    # Unescape HTML entities
    clean_text = html.unescape(clean_text)
    # Normalize whitespaces
    clean_text = ' '.join(clean_text.split())
    return clean_text

def parse_release_notes():
    url = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    
    with urllib.request.urlopen(req, timeout=10) as response:
        xml_data = response.read()
    
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    feed_title = root.find('atom:title', ns)
    feed_title_text = feed_title.text if feed_title is not None else "BigQuery Release Notes"
    
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        title_el = entry.find('atom:title', ns)
        date_str = title_el.text if title_el is not None else ""
        
        updated_el = entry.find('atom:updated', ns)
        updated_str = updated_el.text if updated_el is not None else ""
        
        # Parse ISO date for sorting/formatting
        parsed_date = None
        if updated_str:
            try:
                # Remove timezone offset colon for older python compatibility if needed
                # e.g., 2026-06-15T00:00:00-07:00 -> 2026-06-15T00:00:00-0700
                date_clean = re.sub(r'([+-]\d{2}):(\d{2})$', r'\1\2', updated_str)
                parsed_date = datetime.strptime(date_clean, "%Y-%m-%dT%H:%M:%S%z")
            except Exception:
                pass
        
        link_el = entry.find('atom:link[@rel="alternate"]', ns)
        if link_el is None:
            link_el = entry.find('atom:link', ns)
        link_href = link_el.attrib.get('href', '') if link_el is not None else ''
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        # Split updates by <h3> headings
        updates = []
        pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=(?:<h3>|$))', re.DOTALL)
        matches = pattern.findall(content_html)
        
        if not matches:
            # Fallback
            plain_desc = clean_html_tags(content_html)
            updates.append({
                'type': 'Update',
                'description_html': content_html,
                'description_text': plain_desc,
                'short_text': plain_desc[:200] + '...' if len(plain_desc) > 200 else plain_desc
            })
        else:
            for item_type, item_content in matches:
                item_type = item_type.strip()
                item_content = item_content.strip()
                plain_desc = clean_html_tags(item_content)
                updates.append({
                    'type': item_type,
                    'description_html': item_content,
                    'description_text': plain_desc,
                    'short_text': plain_desc[:200] + '...' if len(plain_desc) > 200 else plain_desc
                })
        
        entries.append({
            'date': date_str,
            'updated': updated_str,
            'timestamp': parsed_date.timestamp() if parsed_date else 0,
            'link': link_href,
            'updates': updates
        })
        
    # Sort entries by timestamp descending
    entries.sort(key=lambda x: x['timestamp'], reverse=True)
    return {
        'feed_title': feed_title_text,
        'entries': entries
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    try:
        data = parse_release_notes()
        return jsonify(data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5005)
