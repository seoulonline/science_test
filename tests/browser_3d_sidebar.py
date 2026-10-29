"""Sidebar settings, interactive WebGL, and the no-WebGL fallback.
Run with the app server running. Uses software WebGL in headless CI only.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image

BASE = os.environ.get('SAIEN_TEST_URL', 'http://127.0.0.1:3000')
OUT = Path('/tmp/saien-3d-checks'); OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle')
    page.locator('.topbar [data-action="edit-sidebar"]').click()
    page.locator('#sidebar-brand').fill('우리 물리 교실')
    page.locator('#sidebar-notebook').fill('우리의 발견 기록')
    page.locator('#sidebar-message').fill('<img src=x onerror=window.injected=true>\n질문을 모아 보세요.')
    page.locator('#sidebar-form button[type="submit"]').click()
    expect(page.locator('[data-sidebar="brand"]')).to_have_text('우리 물리 교실')
    expect(page.locator('[data-sidebar="notebook"]')).to_have_text('우리의 발견 기록')
    assert page.locator('.sidebar img').count()==0
    assert page.evaluate('window.injected') is None
    page.locator('[data-view="notebook"]').click()
    expect(page.locator('#notebook-view')).to_be_visible()
    expect(page.locator('#note-count')).to_have_text('0')
    page.reload(wait_until='networkidle')
    expect(page.locator('[data-sidebar="brand"]')).to_have_text('우리 물리 교실')
    page.locator('.topbar [data-action="edit-sidebar"]').click()
    page.locator('#sidebar-brand').fill('취소할 변경')
    page.locator('#sidebar-form [data-action="close-sidebar"]').last.click()
    expect(page.locator('[data-sidebar="brand"]')).to_have_text('우리 물리 교실')
    page.locator('.topbar [data-action="edit-sidebar"]').click()
    page.locator('#sidebar-defaults').click()
    expect(page.locator('#sidebar-brand')).to_have_value('사이언')
    expect(page.locator('[data-sidebar="brand"]')).to_have_text('우리 물리 교실')
    page.locator('#sidebar-form button[type="submit"]').click()
    expect(page.locator('[data-sidebar="brand"]')).to_have_text('사이언')
    print('PASS: 사이드바 편집·기기 저장·새로고침·취소·기본값·메뉴 유지·HTML 이스케이프',flush=True)

    page.locator('[data-dimension="3d"]').click()
    expect(page.locator('#scene-viewport canvas')).to_have_count(1,timeout=30000)
    expect(page.locator('#scene-viewport')).to_have_attribute('data-i1','1.71')
    page.locator('#scene-3d').scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.evaluate("document.querySelector('#toast').classList.remove('show')")
    page.locator('#scene-3d').screenshot(path=str(OUT/'desktop-3d.png'))
    im=Image.open(OUT/'desktop-3d.png').convert('RGB')
    # Require a real scene with varied geometry colors, not a blank canvas or a loading message.
    assert len(im.getcolors(im.width*im.height))>300
    expect(page.locator('#scene-viewport')).to_have_attribute('data-i3','0.86')
    page.locator('#r2').focus()
    for _ in range(6): page.keyboard.press('ArrowRight')
    expect(page.locator('#scene-viewport')).to_have_attribute('data-i3','1.00')
    page.locator('#switch').click()
    expect(page.locator('#scene-viewport')).to_have_attribute('data-i3','0.00')
    expect(page.locator('#scene-viewport')).to_have_attribute('data-closed','false')
    page.locator('[data-law="voltage"]').click()
    page.locator('#loop-select').select_option('r3')
    expect(page.locator('#law-readout')).to_contain_text('닫힌 도전 고리가 아닙니다')
    page.locator('#scene-viewport').focus()
    before=page.locator('#scene-viewport').get_attribute('data-camera')
    page.keyboard.press('ArrowRight')
    assert page.locator('#scene-viewport').get_attribute('data-camera')!=before
    page.locator('#reset-camera').click()
    assert page.locator('#scene-viewport').get_attribute('data-camera')==before
    page.locator('#camera-zoom-in').click()
    assert page.locator('#scene-viewport').get_attribute('data-camera')!=before
    page.locator('#camera-top').click()
    assert ',0.070,' in page.locator('#scene-viewport').get_attribute('data-camera')
    page.locator('#reset').click()
    expect(page.locator('#scene-viewport')).to_have_attribute('data-i3','0.86')
    # Reduced motion initially pauses both animations; play/pause remains shared.
    expect(page.locator('#scene-viewport')).to_have_attribute('data-playing','false')
    page.locator('#play').click()
    expect(page.locator('#scene-viewport')).to_have_attribute('data-playing','true')
    page.locator('#play').click()
    page.locator('[data-dimension="2d"]').click()
    expect(page.locator('#diagram')).to_be_visible()
    page.locator('[data-dimension="3d"]').click()
    expect(page.locator('#scene-viewport canvas')).to_have_count(1)
    page.locator('[data-view="guide"]').click()
    page.locator('[data-view="lesson"]').click()
    expect(page.locator('#scene-3d')).to_be_visible()
    print('PASS: WebGL 렌더·2D/3D 공유 계산·개방 가지·고리·시점·확대·정지·화면 재진입',flush=True)

    for width in [390,768]:
        page.set_viewport_size({'width':width,'height':844})
        page.locator('#scene-3d').scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        page.locator('#scene-3d').screenshot(path=str(OUT/f'3d-{width}.png'))
        for label in page.locator('.scene-label').all():
            assert label.evaluate('e => e.scrollWidth <= e.clientWidth+2'), '3D label wraps or clips'
        page.locator('.topbar [data-action="edit-sidebar"]').click()
        expect(page.locator('#sidebar-form button[type="submit"]')).to_be_visible()
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        page.locator('#sidebar-form [data-action="close-sidebar"]').last.click()
    page.locator('#scene-viewport canvas').evaluate("canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    expect(page.locator('[data-dimension=\"2d\"]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('[data-dimension=\"3d\"]')).to_be_disabled()
    assert not errors,errors
    print('PASS: 모바일·태블릿의 3D 및 편집 화면, 자바스크립트 오류 없음',flush=True)
    browser.close()

    no_gl=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-webgl'])
    page=no_gl.new_page(viewport={'width':1200,'height':900})
    page.goto(BASE,wait_until='networkidle')
    page.locator('[data-dimension="3d"]').click()
    expect(page.locator('#toast')).to_contain_text('2D에서 탐구를 계속',timeout=30000)
    expect(page.locator('#diagram')).to_be_visible()
    expect(page.locator('[data-dimension="2d"]')).to_have_attribute('aria-pressed','true')
    page.locator('#switch').click()
    expect(page.locator('#switch')).to_have_attribute('aria-checked','false')
    print('PASS: WebGL 미지원 시 2D 복귀 및 회로 조작 유지',flush=True)
    no_gl.close()
