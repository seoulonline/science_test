"""Functional browser checks. Requires Python Playwright and system Chromium.
Start the app separately, then run: python3 tests/browser_smoke.py
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SAIEN_TEST_URL', 'http://127.0.0.1:3000')
SHOTS = Path('/tmp/saien-checks')
SHOTS.mkdir(exist_ok=True)
checks = []

def passed(name):
    checks.append(name)
    print('PASS:', name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until='networkidle')
    expect(page.locator('h1')).to_contain_text('갈라지는 전류')
    expect(page.locator('#circuit-svg')).to_have_attribute('aria-label', __import__('re').compile('I₁ 1.71 A'))
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    page.locator('.first-thought summary').click()
    page.locator('#reflection-before').fill('처음에는 저항에서 전류가 줄어든다고 생각했다.')
    page.locator('.first-thought summary').click()
    page.screenshot(path=str(SHOTS/'desktop.png'), full_page=True)
    passed('개념 화면·초기 회로·데스크톱 레이아웃')

    # Range keyboard navigation exercises the real input event.
    page.locator('#r2').focus()
    for _ in range(6): page.keyboard.press('ArrowRight')
    expect(page.locator('#r2-out')).to_have_text('12 Ω')
    expect(page.locator('#circuit-svg')).to_have_attribute('aria-label', __import__('re').compile('I₁ 1.50 A, I₂ 0.50 A, I₃ 1.00 A'))
    page.locator('#switch').click()
    expect(page.locator('#switch')).to_have_attribute('aria-checked','false')
    expect(page.locator('#circuit-svg')).to_have_attribute('aria-label', __import__('re').compile('I₃ 0.00 A'))
    page.locator('[data-law="voltage"]').click()
    page.locator('#loop-select').select_option('r3')
    expect(page.locator('#law-readout')).to_contain_text('닫힌 도전 고리가 아닙니다')
    page.locator('#loop-select').select_option('r2')
    expect(page.locator('.potential-chart')).to_be_visible()
    page.locator('#reverse-loop').click()
    expect(page.locator('#reverse-loop')).to_have_attribute('aria-pressed','true')
    page.locator('#reset').click()
    expect(page.locator('#r2-out')).to_have_text('6 Ω')
    expect(page.locator('#switch')).to_have_attribute('aria-checked','true')
    passed('슬라이더 키보드 조작·개방 가지·고리 선택·역방향·초기화')

    page.locator('[data-step="1"]').click()
    page.locator('#prediction').fill('R₂를 늘리면 I₃는 증가할 것이다.')
    page.locator('#generalization').fill('정상 상태에서 전하는 분기점에 쌓이지 않는다.')
    for preset in ['base','r2','open']:
        page.locator(f'[data-preset="{preset}"]').click()
        page.locator('#record').click()
        expect(page.locator('#record-prediction')).to_have_value('R₂를 늘리면 I₃는 증가할 것이다.')
        page.locator('#record-observation').fill('전하와 에너지의 보존을 비교했다. <script>window.bad=true</script>')
        page.locator('#record-form button[type="submit"]').click()
    expect(page.locator('#note-count')).to_have_text('3')
    page.locator('[data-view="notebook"]').click()
    expect(page.locator('tbody tr')).to_have_count(3)
    expect(page.locator('.note-card')).to_have_count(3)
    assert page.evaluate('window.bad') is None
    page.reload(wait_until='networkidle')
    page.locator('[data-view="notebook"]').click()
    expect(page.locator('tbody tr')).to_have_count(3)
    with page.expect_download() as info: page.locator('#download-notes').click()
    download = info.value
    text = Path(download.path()).read_text()
    assert '관찰 #3' in text and '정상 상태에서 전하는' in text
    passed('세 조건 기록·예측 연결·입력 이스케이프·새로고침 저장·파일 다운로드')

    page.locator('[data-view="lesson"]').click()
    page.locator('[data-step="2"]').click()
    for i, answer in enumerate([2,1,0]):
        page.locator(f'[data-case="{i}"]').click()
        page.locator(f'input[name="transfer-answer"][value="{answer}"]').check()
        page.locator(f'#transfer-reason-{i}').fill('시스템의 경계와 축적 여부를 확인해야 한다.')
        page.locator('#challenge-form button[type="submit"]').click()
        expect(page.locator('#challenge-feedback')).to_contain_text('모형의 예측과 일치')
    page.locator('[data-step="3"]').click()
    expect(page.locator('#reflection-before')).to_have_value('처음에는 저항에서 전류가 줄어든다고 생각했다.')
    page.locator('#reflection-after').fill('전하가 아닌 에너지가 전환된다는 점을 이해했다.')
    page.locator('[data-step="0"]').click()
    page.locator('[data-step="3"]').click()
    expect(page.locator('#reflection-after')).to_have_value('전하가 아닌 에너지가 전환된다는 점을 이해했다.')
    page.locator('#open-guide').click()
    expect(page.locator('#guide-view')).to_contain_text('172–173쪽')
    page.locator('#guide-start').click()
    passed('세 전이 문제·설명 피드백·성찰 보존·출처와 수업 안내')

    for width in [390,768,1024]:
        page.set_viewport_size({'width':width,'height':844})
        page.locator('[data-step="0"]').click()
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'overflow at {width}'
        expect(page.locator('#record')).to_be_visible()
        page.evaluate("document.documentElement.style.scrollBehavior='auto'; window.scrollTo({top:0,behavior:'instant'}); document.querySelector('#toast').classList.remove('show')")
        page.screenshot(path=str(SHOTS/f'width-{width}.png'),full_page=True)
    passed('390·768·1024px 반응형 레이아웃')
    assert not errors, errors
    passed('전체 사용 흐름에서 자바스크립트 오류 없음')
    browser.close()
print(f'{len(checks)} browser checks passed; screenshots: {SHOTS}')
