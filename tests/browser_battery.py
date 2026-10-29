"""Textbook-linked internal resistance, source inspection, and compatibility."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
OUT=Path('/tmp/saien-battery-checks');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1050},reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('SAIEN_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
    expect(page.locator('#internalR-out')).to_have_text('0 Ω')
    expect(page.locator('#terminal-summary')).to_contain_text('단자 전압 12.00 V')
    page.locator('[data-action="inspect-battery"]').click()
    expect(page.locator('#battery-inspector')).to_be_visible()
    expect(page.locator('#battery-inspector')).to_contain_text('실제 전지의 화학적 단면')
    expect(page.locator('.battery-source')).to_contain_text('167–168쪽(PDF 30–31쪽)')
    page.locator('#internalR').focus()
    page.keyboard.press('ArrowRight');page.keyboard.press('ArrowRight')
    expect(page.locator('#internalR-out')).to_have_text('1 Ω')
    expect(page.locator('#terminal-summary')).to_contain_text('단자 전압 10.50 V')
    expect(page.locator('#terminal-summary')).to_contain_text('내부 전압 강하 1.50 V')
    expect(page.locator('#battery-values')).to_contain_text('2.25 W')
    expect(page.locator('#battery-values')).to_contain_text('18.00 W ≈ 15.75 W + 2.25 W')
    expect(page.locator('#circuit-svg')).to_have_attribute('aria-label',__import__('re').compile('I₁ 1.50 A, I₂ 0.75 A, I₃ 0.75 A'))
    page.locator('[data-law="voltage"]').click()
    expect(page.locator('#law-readout')).to_contain_text('+12.00 − 1.50 − 6.00 − 4.50')
    expect(page.locator('.potential-chart')).to_contain_text('내부 r 통과')
    page.locator('#reverse-loop').click()
    expect(page.locator('#law-readout')).to_contain_text('+4.50 + 6.00 + 1.50 − 12.00')
    expect(page.locator('.potential-chart')).to_contain_text('내부 r 역방향')
    page.locator('#battery-inspector').screenshot(path=str(OUT/'equivalent-model.png'))
    print('PASS: 교과서 출처 표시·내부 보기·단자 전압·전류·전력 수지·고리의 내부 전압 강하',flush=True)

    page.locator('#battery-in-3d').click()
    expect(page.locator('#scene-viewport canvas')).to_have_count(1,timeout=30000)
    expect(page.locator('#scene-viewport')).to_have_attribute('data-battery-open','true')
    expect(page.locator('#scene-viewport')).to_have_attribute('data-i1','1.50')
    expect(page.locator('.scene-battery-action[aria-label="내부 저항 살펴보기"]')).to_be_visible()
    page.locator('#scene-3d').scroll_into_view_if_needed();page.wait_for_timeout(300)
    page.locator('#scene-3d').screenshot(path=str(OUT/'cutaway-3d.png'))
    page.locator('#close-battery').click()
    expect(page.locator('#scene-viewport')).to_have_attribute('data-battery-open','false')
    expect(page.locator('#battery-inspector')).to_be_hidden()
    page.locator('.scene-battery-action[aria-label="배터리 내부 등가 모형 살펴보기"]').click()
    expect(page.locator('#battery-inspector')).to_be_visible()
    expect(page.locator('#scene-viewport')).to_have_attribute('data-battery-open','true')
    page.locator('#switch').click()
    expect(page.locator('#scene-viewport')).to_have_attribute('data-i3','0.00')
    expect(page.locator('#terminal-summary')).to_contain_text('단자 전압 10.91 V')
    page.locator('#record').click()
    expect(page.locator('#record-summary')).to_contain_text('내부 r 1 Ω · 단자 전압 10.91 V')
    page.locator('#record-form button[type="submit"]').click()
    page.locator('[data-view="notebook"]').click()
    expect(page.locator('tbody')).to_contain_text('10.91 V')
    with page.expect_download() as info:page.locator('#download-notes').click()
    text=Path(info.value.path()).read_text()
    assert '내부 r=1 Ω' in text and '단자 전압=10.9091 V' in text
    print('PASS: 3D 투명 외피·내부 등가 모형·클릭·닫기·공유 전류·관찰 기록과 내려받기',flush=True)

    page.locator('[data-view="lesson"]').click()
    for width in [390,768]:
        page.set_viewport_size({'width':width,'height':844})
        expect(page.locator('#battery-inspector')).to_be_visible()
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        page.locator('#battery-inspector').screenshot(path=str(OUT/f'inspector-{width}.png'))
    page.locator('#reset').click()
    expect(page.locator('#internalR-out')).to_have_text('0 Ω')
    expect(page.locator('#terminal-summary')).to_contain_text('단자 전압 12.00 V')
    # Older browser records omit internalR and terminalVoltage; retain their ideal-source meaning.
    page.evaluate("""() => {
      const saved=JSON.parse(localStorage.getItem('saien-lab-v1'));
      delete saved.notes[0].circuit.internalR;
      delete saved.notes[0].result.terminalVoltage;
      localStorage.setItem('saien-lab-v1',JSON.stringify(saved));
    }""")
    page.reload(wait_until='networkidle');page.locator('[data-view="notebook"]').click()
    expect(page.locator('tbody')).to_contain_text('12.00 V')
    expect(page.locator('tbody')).not_to_contain_text('NaN')
    assert not errors,errors
    print('PASS: 모바일·태블릿의 내부 보기·초기화·이전 저장 형식 호환·자바스크립트 오류 없음',flush=True)
    browser.close()
