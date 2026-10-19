"""Turns each document's Markdown (docs.json → "md") into the HTML fragment the site's reader shows ("src").

Only the Markdown these guides use: headings, paragraphs, nested - / 1. lists, task boxes, ``` blocks,
**bold**, `code`, [links](url) and backslash escapes. @@FLOW@@ becomes the one-run flow picture.

Run: python3 apps/event-game-editor/docs/build-docs.py
"""
import html, json, re
from pathlib import Path

HERE = Path(__file__).parent

FLOW = '''<figure class="doc-flow" aria-label="한 판의 흐름: 스토리와 랜덤 인카운터 묶음이 번갈아 나오고 결말로 끝납니다">
<ol>
<li class="story"><b>스토리 1</b><span>도입 · 능력 2개 받기</span></li>
<li class="roll"><b>🎲 1챕터 묶음</b><span>인카운터 3~4개 중 몇 번</span></li>
<li class="story"><b>스토리 2</b><span>전환점 · 기억 읽기</span></li>
<li class="roll"><b>🎲 2챕터 묶음</b><span>인카운터 3~4개 중 몇 번</span></li>
<li class="story"><b>스토리 3</b><span>결말 직전 · 모든 기억</span></li>
<li class="end"><b>결말 3가지</b><span>🏁 엔딩 · ☠ 사망 장면 · 일반 사망</span></li>
</ol>
<figcaption>한 판의 흐름 · 스토리 3 · 인카운터 묶음 2 · 결말 3</figcaption>
</figure>'''


def inline(text):
    out, i = [], 0
    pattern = re.compile(r'`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(<?([^)>]+)>?\)|\\(.)')
    for m in pattern.finditer(text):
        out.append(html.escape(text[i:m.start()]))
        if m.group(1) is not None:
            out.append('<code>' + html.escape(m.group(1)) + '</code>')
        elif m.group(2) is not None:
            out.append('<strong>' + inline(m.group(2)) + '</strong>')
        elif m.group(3) is not None:
            out.append('<a href="' + html.escape(m.group(4), quote=True) + '" target="_blank" rel="noopener">' + inline(m.group(3)) + '</a>')
        else:
            out.append(html.escape(m.group(5)))
        i = m.end()
    out.append(html.escape(text[i:]))
    return ''.join(out)


def slug(text, used):
    base = re.sub(r'[^\w가-힣]+', '-', text).strip('-').lower() or 'section'
    s, n = base, 2
    while s in used:
        s, n = f'{base}-{n}', n + 1
    used.add(s)
    return s


def convert(md):
    lines = md.split('\n')
    out, para, stack, used, i = [], [], [], set(), 0

    def flush():
        if para:
            out.append('<p>' + inline(' '.join(para)) + '</p>')
            para.clear()

    def close_lists(level=-1):
        while stack and stack[-1][0] > level:
            out.append('</li></' + stack.pop()[1] + '>')

    while i < len(lines):
        line = lines[i]
        if line.startswith('```'):
            flush(); close_lists()
            body = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                body.append(lines[i]); i += 1
            out.append('<pre><code>' + html.escape('\n'.join(body)) + '</code></pre>')
            i += 1
            continue
        if line.strip() == '@@FLOW@@':
            flush(); close_lists(); out.append(FLOW); i += 1; continue
        m = re.match(r'^(#{1,3}) (.*)$', line)
        if m:
            flush(); close_lists()
            level, text = len(m.group(1)), m.group(2).strip()
            if level == 1:
                i += 1
                continue  # the reader shows the title in its own header
            out.append(f'<h{level} id="{slug(text, used)}">{inline(text)}</h{level}>')
            i += 1
            continue
        m = re.match(r'^( *)(-|\d+\.) (.*)$', line)
        if m:
            flush()
            level, tag, text = len(m.group(1)) // 2, 'ol' if m.group(2)[0].isdigit() else 'ul', m.group(3)
            if stack and stack[-1][0] == level and stack[-1][1] != tag:
                close_lists(level - 1)
            if not stack or stack[-1][0] < level:
                out.append(f'<{tag}>' if tag == 'ul' else f'<ol start="{m.group(2)[:-1]}">')
                stack.append((level, tag))
            else:
                close_lists(level)
                out.append('</li>')
            task = re.match(r'^\[( |x)\] (.*)$', text)
            if task:
                out.append('<li class="task"><span class="box" aria-hidden="true"></span>' + inline(task.group(2)))
            else:
                out.append('<li>' + inline(text))
            i += 1
            continue
        if not line.strip():
            flush()
            if not (i + 1 < len(lines) and re.match(r'^( *)(-|\d+\.) ', lines[i + 1]) and stack):
                close_lists()
            i += 1
            continue
        if stack and line.startswith('  '):
            out.append(' ' + inline(line.strip()))
            i += 1
            continue
        close_lists()
        para.append(line.strip())
        i += 1
    flush(); close_lists()
    html_out = '\n'.join(out)
    # The first paragraph is the date line.
    return html_out.replace('<p>', '<p class="doc-meta">', 1)


def main():
    docs = json.loads((HERE / 'docs.json').read_text())
    for d in docs:
        md = (HERE / d['md']).read_text()
        (HERE / d['src']).write_text(convert(md) + '\n')
        print(d['src'], len(md), 'chars')


if __name__ == '__main__':
    main()
